"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Mail, Lock, User, Eye, EyeOff } from "lucide-react";
import Link from "next/link";

export default function SignupPage() {
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
  const router = useRouter();

  // 디바운스를 위한 ref
  const emailTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const nicknameTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
        message: emailValue && !isValidEmail(emailValue) ? "올바른 이메일 형식을 입력하세요" : "", 
        checking: false 
      });
      return;
    }

    setEmailStatus(prev => ({ ...prev, checking: true }));

    try {
      const response = await fetch('/api/check-email', {
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
          message: data.message,
          checking: false
        });
      } else {
        setEmailStatus({
          available: false,
          message: data.error || '확인 중 오류가 발생했습니다.',
          checking: false
        });
      }
    } catch (error) {
      console.error('이메일 확인 에러:', error);
      setEmailStatus({
        available: false,
        message: '네트워크 오류가 발생했습니다.',
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
      const response = await fetch('/api/check-nickname', {
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
          message: data.message,
          checking: false
        });
      } else {
        setNicknameStatus({
          available: false,
          message: data.error || '확인 중 오류가 발생했습니다.',
          checking: false
        });
      }
    } catch (error) {
      console.error('닉네임 확인 에러:', error);
      setNicknameStatus({
        available: false,
        message: '네트워크 오류가 발생했습니다.',
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
    if (!isValidEmail(email)) {
      alert('올바른 이메일 형식을 입력하세요.');
      return;
    }
    
    if (emailStatus.available !== true) {
      alert('이메일 중복 확인을 완료하세요.');
      return;
    }
    
    if (nicknameStatus.available !== true) {
      alert('닉네임 중복 확인을 완료하세요.');
      return;
    }

    // if (password.length < 6) {
    //   alert('비밀번호는 최소 6자 이상이어야 합니다.');
    //   return;
    // }
    
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
        alert('회원가입이 성공적으로 완료되었습니다!');
        router.push('/login');
      } else {
        alert(data.error || '회원가입 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('회원가입 에러:', error);
      alert('네트워크 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  // 모든 조건이 만족되는지 확인하는 함수 추가
  const isFormValid = () => {
    return email && 
           password && 
           nickname && 
           isValidEmail(email) && 
           emailStatus.available === true && 
           nicknameStatus.available === true;
  };

  // 모든 필수 필드가 입력되었는지 확인하는 함수
  const isAllFieldsFilled = () => {
    return email && password && nickname;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <Card className="shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">회원가입</CardTitle>
            <CardDescription className="text-center">
              새 계정을 만들어 서비스를 시작하세요
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-gray-700">
                  이메일
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="이메일을 입력하세요"
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
                      <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
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
                <label htmlFor="password" className="text-sm font-medium text-gray-700">
                  비밀번호
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="비밀번호를 입력하세요"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                    autoComplete="off"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="nickname" className="text-sm font-medium text-gray-700">
                  닉네임
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="nickname"
                    type="text"
                    placeholder="닉네임을 입력하세요"
                    value={nickname}
                    onChange={handleNicknameChange}
                    className={`pl-10 ${
                      nicknameStatus.available === false ? 'border-red-500' : 
                      nicknameStatus.available === true ? 'border-green-500' : ''
                    }`}
                    autoComplete="off"
                    required
                  />
                  {nicknameStatus.checking && (
                    <div className="absolute right-3 top-3">
                      <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
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
                className={`w-full ${
                  isFormValid() 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                    : isAllFieldsFilled()
                    ? 'bg-gray-600 hover:bg-gray-700 text-white'
                    : 'bg-gray-400 text-gray-300 cursor-not-allowed'
                }`}
                disabled={
                  isLoading || 
                  !isAllFieldsFilled() || 
                  !isValidEmail(email) || 
                  emailStatus.available !== true || 
                  nicknameStatus.available !== true
                }
              >
                {isLoading ? "가입 중..." : "회원가입"}
              </Button>
            </form>

            <Separator />

            <div className="text-center">
              <span className="text-sm text-gray-600">
                이미 계정이 있으신가요?{" "}
                <Link href="/login" className="text-blue-600 hover:underline font-medium">
                  로그인
                </Link>
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

