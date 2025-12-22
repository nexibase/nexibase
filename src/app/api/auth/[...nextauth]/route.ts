import NextAuth, { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import NaverProvider from "next-auth/providers/naver"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export const authOptions: NextAuthOptions = {
  providers: [
    // 기존 이메일/비밀번호 로그인
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("이메일과 비밀번호를 입력해주세요.")
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        })

        if (!user || !user.password) {
          throw new Error("등록되지 않은 이메일입니다.")
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password)

        if (!isPasswordValid) {
          throw new Error("비밀번호가 올바르지 않습니다.")
        }

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
    }),

    // Naver 로그인
    NaverProvider({
      clientId: process.env.NAVER_CLIENT_ID!,
      clientSecret: process.env.NAVER_CLIENT_SECRET!,
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

          // 1. 먼저 providerAccountId로 탈퇴한 계정인지 확인
          const withdrawnUser = await prisma.user.findFirst({
            where: {
              provider: account?.provider,
              providerId: account?.providerAccountId,
              status: 'withdrawn'
            }
          })

          if (withdrawnUser) {
            // 탈퇴한 계정으로 다시 로그인 시도
            console.log("탈퇴한 계정으로 로그인 시도:", account?.providerAccountId)
            return "/login?error=WithdrawnAccount"
          }

          // 2. 기존 사용자 확인 (이메일로)
          let existingUser = await prisma.user.findUnique({
            where: { email }
          })

          if (existingUser) {
            // 기존 사용자가 탈퇴 상태인지 확인
            if (existingUser.status === 'withdrawn') {
              return "/login?error=WithdrawnAccount"
            }

            // 기존 사용자가 있으면 소셜 연동 정보 업데이트
            await prisma.user.update({
              where: { email },
              data: {
                provider: account?.provider,
                providerId: account?.providerAccountId,
                image: user.image || existingUser.image,
              }
            })
          } else {
            // 새 사용자 생성
            const nickname = user.name || `user_${Date.now()}`

            // 닉네임 중복 확인
            let finalNickname = nickname
            let counter = 1
            while (await prisma.user.findFirst({ where: { nickname: finalNickname } })) {
              finalNickname = `${nickname}_${counter}`
              counter++
            }

            existingUser = await prisma.user.create({
              data: {
                email,
                nickname: finalNickname,
                provider: account?.provider,
                providerId: account?.providerAccountId,
                image: user.image,
                emailVerified: new Date(), // 소셜 로그인은 이메일 인증 완료로 처리
                level: 1,
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

      // 소셜 로그인 후 DB에서 사용자 정보 가져오기
      if (account?.provider !== "credentials" && token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email }
        })
        if (dbUser) {
          token.id = String(dbUser.id)
          token.name = dbUser.nickname
          token.level = dbUser.level
          token.role = dbUser.role
        }
      }

      return token
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.level = token.level as number
        session.user.role = token.role as string
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
  },

  secret: process.env.NEXTAUTH_SECRET,
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
