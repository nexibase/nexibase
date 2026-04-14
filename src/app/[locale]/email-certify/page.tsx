"use client";

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

function EmailCertifyContent() {
  const t = useTranslations('auth');
  const [verificationStatus, setVerificationStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const verifyEmail = async () => {
      const mb_id = searchParams.get('mb_id');
      const mb_md5 = searchParams.get('mb_md5');
      
      if (!mb_id || !mb_md5) {
        setVerificationStatus('error');
        setMessage(t('invalidVerification'));
        return;
      }

      try {
        const response = await fetch(`/api/email-certify?mb_id=${mb_id}&mb_md5=${mb_md5}`);
        const data = await response.json();

        if (response.ok) {
          setVerificationStatus('success');
          setMessage(data.message);
        } else {
          setVerificationStatus('error');
          setMessage(data.error);
        }
      } catch (error) {
        console.error('이메일 인증 에러:', error);
        setVerificationStatus('error');
        setMessage(t('networkError'));
      }
    };

    verifyEmail();
  }, [searchParams]);

  const getStatusIcon = () => {
    switch (verificationStatus) {
      case 'loading':
        return <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />;
      case 'success':
        return <CheckCircle className="h-12 w-12 text-green-500" />;
      case 'error':
        return <XCircle className="h-12 w-12 text-red-500" />;
    }
  };

  const getStatusTitle = () => {
    switch (verificationStatus) {
      case 'loading':
        return t('verifying');
      case 'success':
        return t('emailVerified');
      case 'error':
        return t('emailVerificationFailed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <Card className="shadow-lg">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-4">
              {getStatusIcon()}
            </div>
            <CardTitle className="text-2xl font-bold">
              {getStatusTitle()}
            </CardTitle>
            <CardDescription className="text-center">
              {message}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {verificationStatus === 'success' && (
              <Button 
                onClick={() => router.push('/login')}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {t('loginButton')}
              </Button>
            )}
            {verificationStatus === 'error' && (
              <div className="space-y-2">
                <Button 
                  onClick={() => router.push('/signup')}
                  className="w-full"
                >
                  {t('signupButton')}
                </Button>
                <Button
                  onClick={() => router.push('/login')}
                  variant="outline"
                  className="w-full"
                >
                  {t('loginButton')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
    </div>
  );
}

export default function EmailCertifyPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <EmailCertifyContent />
    </Suspense>
  );
} 