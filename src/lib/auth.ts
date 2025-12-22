import crypto from 'crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

/**
 * NextAuth 세션에서 현재 로그인한 사용자 정보 가져오기
 */
export const getSession = async () => {
  try {
    const nextAuthSession = await getServerSession(authOptions);
    if (nextAuthSession?.user?.email) {
      const user = await prisma.user.findUnique({
        where: { email: nextAuthSession.user.email },
        select: {
          id: true,
          email: true,
          nickname: true,
          role: true,
        }
      });
      if (user) return user;
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * NextAuth 세션에서 사용자 정보 가져오기 (API 라우트용)
 */
export const getAuthUser = async () => {
  try {
    const nextAuthSession = await getServerSession(authOptions);
    if (nextAuthSession?.user?.email) {
      const user = await prisma.user.findUnique({
        where: { email: nextAuthSession.user.email }
      });
      if (user) return user;
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * 관리자 권한 확인
 */
export const getAdminUser = async () => {
  const user = await getAuthUser();
  if (!user) return null;
  if (user.role !== 'admin' && user.role !== 'manager') return null;
  return user;
};

/**
 * 그누보드5 PBKDF2 형식으로 비밀번호 해시 생성
 * @param password 원본 비밀번호
 * @returns 해시된 비밀번호 (sha256:반복횟수:솔트:해시 형식)
 */
export const generatePBKDF2Hash = (password: string): string => {
  // 32바이트 랜덤 솔트 생성
  const salt = crypto.randomBytes(24);
  const iterations = 12000;
  
  // PBKDF2-HMAC-SHA256으로 해시 생성 (32바이트)
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256');
  
  // 그누보드5 형식: sha256:반복횟수:솔트(base64):해시(base64)
  const saltBase64 = salt.toString('base64');
  const hashBase64 = hash.toString('base64');
  
  return `sha256:${iterations}:${saltBase64}:${hashBase64}`;
};

/**
 * 입력된 비밀번호와 저장된 해시를 비교하여 검증
 * @param password 입력된 비밀번호
 * @param storedHash DB에 저장된 해시
 * @returns 비밀번호 일치 여부
 */
export const verifyPassword = (password: string, storedHash: string): boolean => {
  try {
    // 해시 형식 파싱: sha256:반복횟수:솔트:해시
    const parts = storedHash.split(':');
    if (parts.length !== 4 || parts[0] !== 'sha256') {
      return false;
    }

    const iterations = parseInt(parts[1]);
    const saltBase64 = parts[2];
    const hashBase64 = parts[3];

    // Base64에서 솔트와 해시 복원
    const salt = Buffer.from(saltBase64, 'base64');
    const storedHashBuffer = Buffer.from(hashBase64, 'base64');

    // 입력된 비밀번호로 같은 방식으로 해시 생성
    const computedHash = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256');

    // 타이밍 공격 방지를 위한 상수 시간 비교
    return crypto.timingSafeEqual(storedHashBuffer, computedHash);
  } catch (error) {
    console.error('비밀번호 검증 중 오류:', error);
    return false;
  }
};

/**
 * 이메일을 이용해서 20글자 unique ID 생성
 * @param email 이메일 주소
 * @returns 20글자 unique ID
 */
export const generateUniqueId = (email: string): string => {
  const hash = crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');
  return hash.substring(0, 20);
}; 