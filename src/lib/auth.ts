import crypto from 'crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

/**
 * Returns the currently logged-in user from the NextAuth session.
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
 * Returns the user from the NextAuth session (for API routes).
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
 * Checks admin privileges.
 */
export const getAdminUser = async () => {
  const user = await getAuthUser();
  if (!user) return null;
  if (user.role !== 'admin' && user.role !== 'manager') return null;
  return user;
};

/**
 * Produces a password hash using the Gnuboard 5 PBKDF2 format.
 * @param password plain-text password
 * @returns hashed password (format: sha256:iterations:salt:hash)
 */
export const generatePBKDF2Hash = (password: string): string => {
  // Generate a 32-byte random salt
  const salt = crypto.randomBytes(24);
  const iterations = 12000;

  // Derive the hash with PBKDF2-HMAC-SHA256 (32 bytes)
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256');

  // Gnuboard 5 format: sha256:iterations:salt(base64):hash(base64)
  const saltBase64 = salt.toString('base64');
  const hashBase64 = hash.toString('base64');

  return `sha256:${iterations}:${saltBase64}:${hashBase64}`;
};

/**
 * Verifies a plain-text password against a stored hash.
 * @param password plain-text password
 * @param storedHash hash value stored in the DB
 * @returns true if the password matches
 */
export const verifyPassword = (password: string, storedHash: string): boolean => {
  try {
    // Parse the stored hash format: sha256:iterations:salt:hash
    const parts = storedHash.split(':');
    if (parts.length !== 4 || parts[0] !== 'sha256') {
      return false;
    }

    const iterations = parseInt(parts[1]);
    const saltBase64 = parts[2];
    const hashBase64 = parts[3];

    // Restore salt and hash from base64
    const salt = Buffer.from(saltBase64, 'base64');
    const storedHashBuffer = Buffer.from(hashBase64, 'base64');

    // Re-hash the input with the same parameters
    const computedHash = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256');

    // Constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(storedHashBuffer, computedHash);
  } catch (error) {
    console.error('password verification failed:', error);
    return false;
  }
};

/**
 * Derives a 20-character unique ID from an email address.
 * @param email email address
 * @returns 20-character unique ID
 */
export const generateUniqueId = (email: string): string => {
  const hash = crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');
  return hash.substring(0, 20);
};
