"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { GoogleReCaptchaProvider, useGoogleReCaptcha } from "react-google-recaptcha-v3";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { markBrowserSession, markJustLoggedIn } from "@/components/providers/SessionProvider";
import { useSite } from "@/lib/SiteContext";

// PasswordCredential 타입 선언
declare global {
  interface Window {
    PasswordCredential?: new (data: { id: string; password: string }) => Credential;
  }
}

// 소셜 로그인 아이콘 컴포넌트
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

// reCAPTCHA 토큰 가져오기 훅 래퍼
function useRecaptchaToken() {
  const context = useGoogleReCaptcha();
  return context?.executeRecaptcha || null;
}

// Turnstile 키 있으면 Turnstile, 없으면 reCAPTCHA 키 확인, 둘 다 없으면 비활성화
const captchaProvider = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  ? "turnstile"
  : process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY
    ? "recaptcha"
    : "";

function LoginForm() {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);
  const executeRecaptcha = useRecaptchaToken();
  const { refreshUser } = useSite();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(searchParams.get("callbackUrl") || "/");
    }
  }, [status, router, searchParams]);

  // URL 에러 파라미터 처리
  useEffect(() => {
    const error = searchParams.get("error");
    if (error === "DeletedAccount" || error === "AccessDenied" || error === "InactiveAccount") {
      setErrorMessage(t("loginFailed"));
    } else if (error === "WithdrawnAccount") {
      setErrorMessage(t("withdrawnAccount"));
    } else if (error) {
      setErrorMessage(t("loginError"));
    }
  }, [searchParams]);

  const checkCaptchaRequired = async (emailToCheck: string) => {
    if (!emailToCheck) return;
    try {
      const res = await fetch(`/api/auth/login-attempts?email=${encodeURIComponent(emailToCheck)}`);
      const data = await res.json();
      setCaptchaRequired(data.failCount > 3);
    } catch {
      // 조회 실패 시 CAPTCHA 없이 진행
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      // reCAPTCHA인 경우 submit 시점에 토큰 발급
      let tokenToSend = captchaToken;
      if (captchaRequired && captchaProvider === "recaptcha" && executeRecaptcha) {
        tokenToSend = await executeRecaptcha("login");
      }

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          captchaToken: tokenToSend || undefined,
        }),
      });

      const data = await res.json();

      if (data.success) {
        markBrowserSession();

        if (window.PasswordCredential && navigator.credentials) {
          try {
            const cred = new window.PasswordCredential({ id: email, password });
            await navigator.credentials.store(cred);
          } catch {
            // 자격 증명 저장 실패해도 로그인은 계속 진행
          }
        }

        // 헤더 등 UI 즉시 갱신
        await refreshUser();

        const callbackUrl = searchParams.get("callbackUrl") || "/";
        router.push(callbackUrl);
        router.refresh();
      } else {
        if (data.captchaRequired) {
          setCaptchaRequired(true);
          setCaptchaToken(null);
          turnstileRef.current?.reset();
        }
        setErrorMessage(t("invalidCredentials"));
      }
    } catch (error) {
      console.error("로그인 에러:", error);
      setErrorMessage(t("networkError"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = async (provider: string) => {
    setSocialLoading(provider);
    try {
      // 소셜 로그인은 리다이렉트 방식이므로, 로그인 플래그를 미리 설정
      markJustLoggedIn();
      const callbackUrl = searchParams.get("callbackUrl") || "/";
      await signIn(provider, { callbackUrl });
    } catch (error) {
      console.error(`${provider} 로그인 에러:`, error);
      alert(t("socialLoginFailed"));
    } finally {
      setSocialLoading(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <Card className="shadow-lg border-border">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">{t("loginTitle")}</CardTitle>
            <CardDescription className="text-center">
              {t("loginDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {errorMessage && (
              <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                {errorMessage}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-foreground">
                  {t("email")}
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder={t("emailPlaceholder")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={(e) => checkCaptchaRequired(e.target.value)}
                    className="pl-10"
                    required
                    autoComplete="username email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-foreground">
                  {t("password")}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={t("passwordPlaceholder")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 h-4 w-4 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end">
                <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                  {t("forgotPassword")}
                </Link>
              </div>

              {captchaRequired && captchaProvider === "turnstile" && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
                <div className="flex justify-center">
                  <Turnstile
                    ref={turnstileRef}
                    siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
                    onSuccess={(token) => setCaptchaToken(token)}
                    onExpire={() => setCaptchaToken(null)}
                    options={{ theme: "auto" }}
                  />
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || (captchaRequired && captchaProvider === "turnstile" && !captchaToken)}
              >
                {isLoading ? t("loggingIn") : t("loginButton")}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  {t("socialLoginDivider")}
                </span>
              </div>
            </div>

            {/* 소셜 로그인 버튼 */}
            <div className="flex flex-col gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleSocialLogin("google")}
                disabled={socialLoading !== null}
                className="w-full"
              >
                {socialLoading === "google" ? (
                  <div className="animate-spin h-5 w-5 border-2 border-muted border-t-primary rounded-full" />
                ) : (
                  <>
                    <GoogleIcon />
                    <span className="ml-2">{t("googleLogin")}</span>
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleSocialLogin("naver")}
                disabled={socialLoading !== null}
                className="w-full"
              >
                {socialLoading === "naver" ? (
                  <div className="animate-spin h-5 w-5 border-2 border-muted border-t-primary rounded-full" />
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#03C75A" d="M16.273 12.845L7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727z"/>
                    </svg>
                    <span className="ml-2">{t("naverLogin")}</span>
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleSocialLogin("kakao")}
                disabled={socialLoading !== null}
                className="w-full"
              >
                {socialLoading === "kakao" ? (
                  <div className="animate-spin h-5 w-5 border-2 border-muted border-t-primary rounded-full" />
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#FEE500" d="M12 3c5.799 0 10.5 3.664 10.5 8.185 0 4.52-4.701 8.184-10.5 8.184a13.5 13.5 0 0 1-1.727-.11l-4.408 2.883c-.501.265-.678.236-.472-.413l.892-3.678c-2.88-1.46-4.785-3.99-4.785-6.866C1.5 6.665 6.201 3 12 3z"/>
                    </svg>
                    <span className="ml-2">{t("kakaoLogin")}</span>
                  </>
                )}
              </Button>
            </div>

            <Separator />

            <div className="text-center">
              <span className="text-sm text-muted-foreground">
                {t("noAccount")}{" "}
                <Link href="/signup" className="text-primary hover:underline font-medium">
                  {t("signupButton")}
                </Link>
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
  if (captchaProvider === "recaptcha") {
    return (
      <GoogleReCaptchaProvider reCaptchaKey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY!}>
        <LoginForm />
      </GoogleReCaptchaProvider>
    );
  }

  return <LoginForm />;
}
