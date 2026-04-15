"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Mail, Lock, User, Eye, EyeOff } from "lucide-react";
import Link from "next/link";

// 소셜 로그인 아이콘 컴포넌트
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

export default function SignupPage() {
  // Theme: default/SignupPage
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const [email, setEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState<{
    available: boolean | null;
    message: string;
    checking: boolean;
  }>({
    available: null,
    message: "",
    checking: false
  });
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [nicknameStatus, setNicknameStatus] = useState<{
    available: boolean | null;
    message: string;
    checking: boolean;
  }>({
    available: null,
    message: "",
    checking: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFirstUser, setIsFirstUser] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const router = useRouter();

  const handleSocialLogin = async (provider: string) => {
    setSocialLoading(provider);
    try {
      await signIn(provider, { callbackUrl: "/" });
    } catch (error) {
      console.error(`${provider} 로그인 에러:`, error);
      alert(t("socialLoginFailed"));
    } finally {
      setSocialLoading(null);
    }
  };

  // 디바운스를 위한 ref
  const emailTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const nicknameTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 첫 회원인지 확인
  useEffect(() => {
    const checkFirstUser = async () => {
      try {
        const response = await fetch('/api/members/check-first');
        const data = await response.json();
        if (data.isFirst) {
          setIsFirstUser(true);
          setNickname("관리자");
          setNicknameStatus({
            available: true,
            message: t("adminAutoSet"),
            checking: false
          });
        }
      } catch (error) {
        console.error('첫 회원 확인 에러:', error);
      }
    };
    checkFirstUser();
  }, []);

  // 이메일 형식 검증 함수 추가
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  };

  // 이메일 중복 확인 함수 (개선됨)
  const checkEmailAvailability = async (emailValue: string) => {
    // 이메일 형식이 유효하지 않으면 중복 확인하지 않음
    if (!emailValue || !isValidEmail(emailValue)) {
      setEmailStatus({ 
        available: null, 
        message: emailValue && !isValidEmail(emailValue) ? t("invalidEmail") : "",
        checking: false 
      });
      return;
    }

    setEmailStatus(prev => ({ ...prev, checking: true }));

    try {
      const response = await fetch('/api/members/check-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: emailValue }),
      });

      const data = await response.json();

      if (response.ok) {
        setEmailStatus({
          available: data.available,
          message: data.available ? t("emailAvailable") : t("emailTaken"),
          checking: false
        });
      } else {
        setEmailStatus({
          available: false,
          message: t("checkingError"),
          checking: false
        });
      }
    } catch (error) {
      console.error('이메일 확인 에러:', error);
      setEmailStatus({
        available: false,
        message: t("networkError"),
        checking: false
      });
    }
  };

  // 닉네임 중복 확인 함수
  const checkNicknameAvailability = async (nicknameValue: string) => {
    if (!nicknameValue || nicknameValue.length < 2) {
      setNicknameStatus({ available: null, message: "", checking: false });
      return;
    }

    setNicknameStatus(prev => ({ ...prev, checking: true }));

    try {
      const response = await fetch('/api/members/check-nick', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nickname: nicknameValue }),
      });

      const data = await response.json();

      if (response.ok) {
        setNicknameStatus({
          available: data.available,
          message: data.available ? t("nicknameAvailable") : t("nicknameTaken"),
          checking: false
        });
      } else {
        setNicknameStatus({
          available: false,
          message: t("checkingError"),
          checking: false
        });
      }
    } catch (error) {
      console.error('닉네임 확인 에러:', error);
      setNicknameStatus({
        available: false,
        message: t("networkError"),
        checking: false
      });
    }
  };

  // 이메일 입력 핸들러 (개선된 디바운스)
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEmail = e.target.value;
    setEmail(newEmail);
    
    // 기존 타이머가 있다면 클리어
    if (emailTimeoutRef.current) {
      clearTimeout(emailTimeoutRef.current);
    }
    
    // 새 타이머 설정
    emailTimeoutRef.current = setTimeout(() => {
      checkEmailAvailability(newEmail);
    }, 500);
  };

  // 닉네임 입력 핸들러 (개선된 디바운스)
  const handleNicknameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 첫 회원인 경우 닉네임 변경 불가
    if (isFirstUser) return;

    const newNickname = e.target.value;
    setNickname(newNickname);

    // 기존 타이머가 있다면 클리어
    if (nicknameTimeoutRef.current) {
      clearTimeout(nicknameTimeoutRef.current);
    }

    // 새 타이머 설정
    nicknameTimeoutRef.current = setTimeout(() => {
      checkNicknameAvailability(newNickname);
    }, 500);
  };

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (emailTimeoutRef.current) {
        clearTimeout(emailTimeoutRef.current);
      }
      if (nicknameTimeoutRef.current) {
        clearTimeout(nicknameTimeoutRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 제출 전 최종 검증
    if (!email) {
      alert(t("emailRequired"));
      return;
    }
    
    if (!isValidEmail(email)) {
      alert(t("invalidEmail"));
      return;
    }
    
    if (emailStatus.available !== true) {
      alert(t("emailCheckRequired"));
      return;
    }
    
    if (!password) {
      alert(t("passwordRequired"));
      return;
    }
    
    // if (password.length < 6) {
    //   alert('비밀번호는 최소 6자 이상이어야 합니다.');
    //   return;
    // }
    
    if (!nickname) {
      alert(t("nicknameRequired"));
      return;
    }
    
    if (nickname.length < 2) {
      alert(t("nicknameMinLength"));
      return;
    }

    if (!/^[가-힣a-zA-Z0-9]+$/.test(nickname.trim())) {
      alert(t("nicknameInvalidChars"));
      return;
    }

    if (nicknameStatus.available !== true) {
      alert(t("nicknameCheckRequired"));
      return;
    }
    
    setIsLoading(true);

    try {
      const response = await fetch('/api/members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          nickname
        }),
      });

      const data = await response.json();

      if (response.ok) {
        alert(t("signupSuccess"));
        router.push('/login');
      } else {
        alert(data.error || t("signupError"));
      }
    } catch (error) {
      console.error('회원가입 에러:', error);
      alert(`${t("networkError")} ${tc("tryAgain")}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 폼 제출 버튼에서 실제로 사용할 수 있도록 수정
  const isFormValid = () => {
    return email && 
           password && 
           nickname && 
           isValidEmail(email) && 
           emailStatus.available === true && 
           nicknameStatus.available === true;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <Card className="shadow-lg border-border">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">{t("signupTitle")}</CardTitle>
            <CardDescription className="text-center">
              {isFirstUser ? (
                <span className="text-blue-600 font-medium">
                  {t("firstUserBecomesAdmin")}
                </span>
              ) : (
                t("signupDescription")
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-foreground">
                  {t("email")}
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder={t("emailPlaceholder")}
                    value={email}
                    onChange={handleEmailChange}
                    className={`pl-10 ${
                      emailStatus.available === false ? 'border-red-500' : 
                      emailStatus.available === true ? 'border-green-500' : ''
                    }`}
                    autoComplete="off"
                    required
                  />
                  {emailStatus.checking && (
                    <div className="absolute right-3 top-3">
                      <div className="animate-spin h-4 w-4 border-2 border-muted border-t-primary rounded-full"></div>
                    </div>
                  )}
                </div>
                {emailStatus.message && (
                  <p className={`text-sm ${
                    emailStatus.available ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {emailStatus.message}
                  </p>
                )}
              </div>
            
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-foreground">
                  {t("password")}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={t("passwordPlaceholder")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                    autoComplete="off"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="nickname" className="text-sm font-medium text-foreground">
                  {t("nickname")}
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="nickname"
                    type="text"
                    placeholder={t("nicknamePlaceholder")}
                    value={nickname}
                    onChange={handleNicknameChange}
                    className={`pl-10 ${
                      nicknameStatus.available === false ? 'border-red-500' :
                      nicknameStatus.available === true ? 'border-green-500' : ''
                    } ${isFirstUser ? 'bg-muted' : ''}`}
                    autoComplete="off"
                    required
                    readOnly={isFirstUser}
                  />
                  {nicknameStatus.checking && (
                    <div className="absolute right-3 top-3">
                      <div className="animate-spin h-4 w-4 border-2 border-muted border-t-primary rounded-full"></div>
                    </div>
                  )}
                </div>
                {nicknameStatus.message && (
                  <p className={`text-sm ${
                    nicknameStatus.available ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {nicknameStatus.message}
                  </p>
                )}
              </div>
  
              <Button
                type="submit"
                disabled={isLoading || !isFormValid()}
                className="w-full"
              >
                {isLoading ? t("signingUp") : t("signupButton")}
              </Button>
              
              {isLoading && (
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    {t("signupProcessing")}
                  </p>
                  <div className="mt-2">
                    <div className="inline-block animate-spin h-4 w-4 border-2 border-muted border-t-primary rounded-full"></div>
                  </div>
                </div>
              )}
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  {t("socialSignupDivider")}
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
                {t("haveAccount")}{" "}
                <Link href="/login" className="text-primary hover:underline font-medium">
                  {t("loginButton")}
                </Link>
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

