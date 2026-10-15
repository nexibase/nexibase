import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

function key() {
  const value = process.env.NOTIFICATION_ENCRYPTION_KEY
  if (!value || !/^[a-f0-9]{64}$/i.test(value)) throw new Error('NOTIFICATION_ENCRYPTION_KEY(64자리 hex)가 필요합니다.')
  return Buffer.from(value, 'hex')
}
export function encryptionReady() {
  return /^[a-f0-9]{64}$/i.test(process.env.NOTIFICATION_ENCRYPTION_KEY || '')
}
export function encrypt(value: unknown) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join('.')
}
export function decrypt<T>(value: string): T {
  const [version, iv, tag, ciphertext] = value.split('.')
  if (version !== 'v1' || !iv || !tag || !ciphertext) throw new Error('암호화된 알림 정보를 읽을 수 없습니다.')
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'))
  decipher.setAuthTag(Buffer.from(tag, 'base64'))
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]).toString('utf8')) as T
}
