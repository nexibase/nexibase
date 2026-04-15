import { Adapter, AdapterUser, AdapterAccount } from "next-auth/adapters"
import { prisma } from "./prisma"

// Custom Prisma adapter that uses Int user IDs
export function CustomPrismaAdapter(): Adapter {
  return {
    // Create user (new user from social login)
    async createUser(user: Omit<AdapterUser, "id">): Promise<AdapterUser> {
      const nickname = user.name || `user_${Date.now()}`

      // Ensure nickname uniqueness
      let finalNickname = nickname
      let counter = 1
      while (await prisma.user.findFirst({ where: { nickname: finalNickname } })) {
        finalNickname = `${nickname}_${counter}`
        counter++
      }

      const created = await prisma.user.create({
        data: {
          email: user.email,
          nickname: finalNickname,
          image: user.image,
          emailVerified: user.emailVerified,
          level: 1,
        },
      })

      return {
        id: String(created.id),
        email: created.email,
        emailVerified: created.emailVerified,
        name: created.nickname,
        image: created.image,
      }
    },

    // Lookup user by ID
    async getUser(id: string): Promise<AdapterUser | null> {
      const user = await prisma.user.findUnique({
        where: { id: parseInt(id) },
      })

      if (!user) return null

      return {
        id: String(user.id),
        email: user.email,
        emailVerified: user.emailVerified,
        name: user.nickname,
        image: user.image,
      }
    },

    // Lookup user by email
    async getUserByEmail(email: string): Promise<AdapterUser | null> {
      const user = await prisma.user.findUnique({
        where: { email },
      })

      if (!user) return null

      return {
        id: String(user.id),
        email: user.email,
        emailVerified: user.emailVerified,
        name: user.nickname,
        image: user.image,
      }
    },

    // Lookup user by Account
    async getUserByAccount({ providerAccountId, provider }: Pick<AdapterAccount, "provider" | "providerAccountId">): Promise<AdapterUser | null> {
      const account = await prisma.account.findUnique({
        where: {
          provider_providerAccountId: {
            provider,
            providerAccountId,
          },
        },
        include: { user: true },
      })

      if (!account) return null

      const user = account.user
      return {
        id: String(user.id),
        email: user.email,
        emailVerified: user.emailVerified,
        name: user.nickname,
        image: user.image,
      }
    },

    // Update user
    async updateUser(user: Partial<AdapterUser> & Pick<AdapterUser, "id">): Promise<AdapterUser> {
      const updated = await prisma.user.update({
        where: { id: parseInt(user.id) },
        data: {
          nickname: user.name ?? undefined,
          email: user.email ?? undefined,
          image: user.image ?? undefined,
          emailVerified: user.emailVerified ?? undefined,
        },
      })

      return {
        id: String(updated.id),
        email: updated.email,
        emailVerified: updated.emailVerified,
        name: updated.nickname,
        image: updated.image,
      }
    },

    // Delete user
    async deleteUser(userId: string): Promise<void> {
      await prisma.user.delete({
        where: { id: parseInt(userId) },
      })
    },

    // Link an Account (social login integration)
    async linkAccount(account: AdapterAccount): Promise<void> {
      await prisma.account.create({
        data: {
          userId: parseInt(account.userId),
          type: account.type,
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          refresh_token: account.refresh_token,
          access_token: account.access_token,
          expires_at: account.expires_at,
          token_type: account.token_type,
          scope: account.scope,
          id_token: account.id_token,
          session_state: account.session_state as string | undefined,
        },
      })
    },

    // Unlink Account
    async unlinkAccount({ providerAccountId, provider }: Pick<AdapterAccount, "provider" | "providerAccountId">): Promise<void> {
      await prisma.account.delete({
        where: {
          provider_providerAccountId: {
            provider,
            providerAccountId,
          },
        },
      })
    },

    // Session-related functions are unused because we use the JWT strategy,
    // but we keep empty implementations to satisfy the Adapter interface.
    async createSession() {
      return { sessionToken: "", userId: "", expires: new Date() }
    },

    async getSessionAndUser() {
      return null
    },

    async updateSession() {
      return { sessionToken: "", userId: "", expires: new Date() }
    },

    async deleteSession() {},

    // Email verification token (unused)
    async createVerificationToken(token: { identifier: string; token: string; expires: Date }) {
      return token
    },

    async useVerificationToken() {
      return null
    },
  }
}
