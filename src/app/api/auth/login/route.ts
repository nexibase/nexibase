import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { encode } from "next-auth/jwt"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

export async function POST(req: NextRequest) {
  try {
    const { email, password, captchaToken } = await req.json()

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown"

    // --- 로그인 실패 횟수 확인 (최근 1시간, 마지막 성공 이후) ---
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

    const lastSuccess = await prisma.loginAttempt.findFirst({
      where: { email, success: true, createdAt: { gte: oneHourAgo } },
      orderBy: { createdAt: "desc" },
    })

    const failCount = await prisma.loginAttempt.count({
      where: {
        email,
        success: false,
        createdAt: {
          gte: lastSuccess ? lastSuccess.createdAt : oneHourAgo,
        },
      },
    })

    // --- CAPTCHA 검증 ---
    if (failCount > 3) {
      if (!captchaToken) {
        return NextResponse.json(
          {
            success: false,
            captchaRequired: true,
            message: "보안 인증이 필요합니다.",
          },
          { status: 200 }
        )
      }

      // Turnstile 키 있으면 Turnstile, 없으면 reCAPTCHA 키 확인
      const provider = process.env.TURNSTILE_SECRET_KEY
        ? "turnstile"
        : process.env.RECAPTCHA_SECRET_KEY
          ? "recaptcha"
          : ""

      if (provider === "turnstile") {
        const res = await fetch(
          "https://challenges.cloudflare.com/turnstile/v0/siteverify",
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              secret: process.env.TURNSTILE_SECRET_KEY!,
              response: captchaToken,
            }),
          }
        )
        const data = await res.json()
        if (!data.success) {
          return NextResponse.json(
            { success: false, message: "보안 인증에 실패했습니다." },
            { status: 400 }
          )
        }
      } else if (provider === "recaptcha") {
        const res = await fetch(
          "https://www.google.com/recaptcha/api/siteverify",
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              secret: process.env.RECAPTCHA_SECRET_KEY!,
              response: captchaToken,
            }),
          }
        )
        const data = await res.json()
        if (!data.success) {
          return NextResponse.json(
            { success: false, message: "보안 인증에 실패했습니다." },
            { status: 400 }
          )
        }
      }
      // provider가 없거나 빈 문자열이면 CAPTCHA 검증 건너뜀
    }

    // --- 사용자 조회 ---
    const user = await prisma.user.findUnique({ where: { email } })

    if (!user) {
      await prisma.loginAttempt.create({
        data: { email, ip, success: false, reason: "존재하지 않는 이메일" },
      })
      return NextResponse.json(
        {
          success: false,
          message: "이메일 또는 비밀번호가 올바르지 않습니다.",
        },
        { status: 401 }
      )
    }

    if (!user.password) {
      await prisma.loginAttempt.create({
        data: { email, ip, success: false, reason: "소셜 전용 계정" },
      })
      return NextResponse.json(
        {
          success: false,
          message: "소셜 로그인으로 가입한 계정입니다. 소셜 로그인을 이용해주세요.",
        },
        { status: 401 }
      )
    }

    // --- 계정 상태 확인 ---
    if (
      user.deletedAt ||
      user.status === "banned" ||
      user.status === "inactive"
    ) {
      await prisma.loginAttempt.create({
        data: { email, ip, success: false, reason: "계정 비활성 상태" },
      })
      return NextResponse.json(
        {
          success: false,
          message: "로그인에 문제가 있습니다. 관리자에게 문의해 주세요.",
        },
        { status: 403 }
      )
    }

    if (user.status === "withdrawn") {
      await prisma.loginAttempt.create({
        data: { email, ip, success: false, reason: "탈퇴한 계정" },
      })
      return NextResponse.json(
        { success: false, message: "탈퇴한 계정입니다." },
        { status: 403 }
      )
    }

    // --- 비밀번호 검증 ---
    const isPasswordValid = await bcrypt.compare(password, user.password)

    if (!isPasswordValid) {
      await prisma.loginAttempt.create({
        data: { email, ip, success: false, reason: "비밀번호 불일치" },
      })
      return NextResponse.json(
        {
          success: false,
          captchaRequired: failCount + 1 > 3,
          message: "이메일 또는 비밀번호가 올바르지 않습니다.",
        },
        { status: 401 }
      )
    }

    // --- 로그인 성공 ---
    await prisma.loginAttempt.create({
      data: { email, ip, success: true },
    })

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastLoginIp: ip },
    })

    // --- JWT 토큰 생성 ---
    const maxAge = authOptions.session?.maxAge ?? 24 * 60 * 60

    const token = await encode({
      token: {
        id: String(user.id),
        email: user.email,
        name: user.nickname,
        picture: user.image,
        sub: String(user.id),
      },
      secret: process.env.NEXTAUTH_SECRET!,
      maxAge,
    })

    // --- 쿠키 설정 및 응답 ---
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        image: user.image,
        role: user.role,
      },
    })

    response.cookies.set("next-auth.session-token", token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge,
    })

    return response
  } catch (error) {
    console.error("로그인 API 에러:", error)
    return NextResponse.json(
      { success: false, message: "서버 오류가 발생했습니다." },
      { status: 500 }
    )
  }
}
