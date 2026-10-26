export const AUTH_POLICY_KEYS = ['signup_enabled', 'social_signup_only', 'email_login_enabled'] as const

export function resolveAuthPolicy(settings: Partial<Record<typeof AUTH_POLICY_KEYS[number], string>>) {
  return {
    signupEnabled: settings.signup_enabled !== 'false',
    socialSignupOnly: settings.social_signup_only === 'true',
    emailLoginEnabled: settings.email_login_enabled !== 'false',
  }
}

export type AuthPolicy = ReturnType<typeof resolveAuthPolicy>

export function canRegister(policy: AuthPolicy, method: 'email' | 'social') {
  return policy.signupEnabled && (method === 'social' || !policy.socialSignupOnly)
}
