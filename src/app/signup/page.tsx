"use client";

import { useState } from "react";
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

  // 이메일 중복 확인 함수
  const checkEmailAvailability = async (emailValue: string) => {
    if (!emailValue || !emailValue.includes('@')) {
      setEmailStatus({ available: null, message: "", checking: false });
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

  // 이메일 입력 필드 수정
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEmail = e.target.value;
    setEmail(newEmail);
    
    // 디바운스를 위해 타이머 사용
    setTimeout(() => {
      if (newEmail === email) {  // 아직 변경되지 않았다면
        checkEmailAvailability(newEmail);
      }
    }, 500);
  };

  // 닉네임 입력 필드 수정
  const handleNicknameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newNickname = e.target.value;
    setNickname(newNickname);
    
    // 디바운스를 위해 타이머 사용
    setTimeout(() => {
      if (newNickname === nickname) {  // 아직 변경되지 않았다면
        checkNicknameAvailability(newNickname);
      }
    }, 500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // 여기에 실제 회원가입 로직을 구현하세요
      // 예시: API 호출, 사용자 등록 등
      console.log("회원가입 시도:", { email, password, nickname });
      
      // 임시로 2초 후 로그인 페이지로 리다이렉트
      await new Promise(resolve => setTimeout(resolve, 2000));
      router.push("/login");
    } catch (error) {
      console.error("회원가입 에러:", error);
    } finally {
      setIsLoading(false);
    }
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
                    className="absolute right-3 top-3 h-4 w-4 text-gray-400 hover:text-gray-600"
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
                className="w-full"
                disabled={isLoading || !email || !password || !nickname || emailStatus.available === false || nicknameStatus.available === false}
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
