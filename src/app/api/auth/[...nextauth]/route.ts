import NextAuth, { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import NaverProvider from "next-auth/providers/naver"
import KakaoProvider from "next-auth/providers/kakao"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import { CustomPrismaAdapter } from "@/lib/auth-adapter"
import bcrypt from "bcryptjs"

export const authOptions: NextAuthOptions = {
  adapter: CustomPrismaAdapter(),

  providers: [
    // 이메일/비밀번호 로그인
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("이메일과 비밀번호를 입력해주세요.")
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        })

        if (!user || !user.password) {
          throw new Error("이메일 또는 비밀번호가 올바르지 않습니다.")
        }

        if (user.deletedAt || user.status === 'banned' || user.status === 'inactive') {
          throw new Error("로그인에 문제가 있습니다. 관리자에게 문의해 주세요.")
        }

        if (user.status === 'withdrawn') {
          throw new Error("탈퇴한 계정입니다.")
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password)

        if (!isPasswordValid) {
          throw new Error("이메일 또는 비밀번호가 올바르지 않습니다.")
        }

        // 마지막 로그인 시간 업데이트
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() }
        })

        return {
          id: String(user.id),
          email: user.email,
          name: user.nickname,
          image: user.image,
        }
      }
    }),

    // Google 로그인
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),

    // Naver 로그인
    NaverProvider({
      clientId: process.env.NAVER_CLIENT_ID!,
      clientSecret: process.env.NAVER_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),

    // Kakao 로그인
    KakaoProvider({
      clientId: process.env.KAKAO_CLIENT_ID!,
      clientSecret: process.env.KAKAO_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
  ],

  callbacks: {
    async signIn({ user, account }) {
      // 소셜 로그인인 경우
      if (account?.provider !== "credentials") {
        try {
          const email = user.email

          if (!email) {
            console.error("소셜 로그인 에러: 이메일 정보 없음")
            return false
          }

          // providerAccountId로 탈퇴한 계정인지 확인
          const existingAccount = await prisma.account.findUnique({
            where: {
              provider_providerAccountId: {
                provider: account!.provider,
                providerAccountId: account!.providerAccountId,
              }
            },
            include: { user: true }
          })

          if (existingAccount?.user.deletedAt) {
            return "/login?error=DeletedAccount"
          }
          if (existingAccount?.user.status === 'withdrawn') {
            return "/login?error=WithdrawnAccount"
          }

          // 이메일로 기존 사용자 확인
          const existingUser = await prisma.user.findUnique({
            where: { email }
          })

          if (existingUser) {
            if (existingUser.deletedAt) {
              return "/login?error=DeletedAccount"
            }
            if (existingUser.status === 'withdrawn') {
              return "/login?error=WithdrawnAccount"
            }
            if (existingUser.status === 'banned') {
              return "/login?error=AccessDenied"
            }
            if (existingUser.status === 'inactive') {
              return "/login?error=InactiveAccount"
            }

            // provider 정보 업데이트
            await prisma.user.update({
              where: { email },
              data: {
                provider: account!.provider,
                providerId: account!.providerAccountId,
                image: user.image || existingUser.image,
                lastLoginAt: new Date(),
              }
            })
          }

          return true
        } catch (error) {
          console.error("소셜 로그인 처리 에러:", error)
          return false
        }
      }

      return true
    },

    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id
      }

      // 소셜 로그인 시 DB에서 사용자 ID 조회
      if (account && account.provider !== "credentials" && token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email as string },
          select: { id: true }
        })
        if (dbUser) {
          token.id = String(dbUser.id)
        }
      }

      return token
    },

    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string

        // DB에서 추가 정보 가져오기
        const dbUser = await prisma.user.findUnique({
          where: { id: parseInt(token.id as string) },
          select: { level: true, role: true, nickname: true, image: true, status: true, deletedAt: true }
        })

        if (dbUser) {
          // 삭제/탈퇴/정지/비활성 사용자는 세션 무효화
          if (dbUser.deletedAt || dbUser.status === 'withdrawn' || dbUser.status === 'banned' || dbUser.status === 'inactive') {
            return { ...session, user: undefined }
          }

          session.user.level = dbUser.level
          session.user.role = dbUser.role
          session.user.name = dbUser.nickname
          session.user.image = dbUser.image
        }
      }
      return session
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24시간
  },

  cookies: {
    sessionToken: {
      name: "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        // maxAge 생략 - 프록시에서 세션 쿠키로 변환
      },
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
