import { getNotificationConfig } from '@/lib/notifications/config';
import { smtpTransport } from '@/lib/notifications/providers';
import { canUseLiveDelivery } from '@/lib/notifications/policy';
import crypto from 'crypto';
import { getTranslations } from 'next-intl/server';


// Build the Gnuboard-5 email verification token (MD5-based)
export const generateEmailVerificationToken = (): string => {
  // Gnuboard 5: md5(pack('V*', rand(), rand(), rand(), rand()))
  const randomBytes = crypto.randomBytes(16); // 4개의 32비트 정수
  const md5Hash = crypto.createHash('md5').update(randomBytes).digest('hex');
  return md5Hash;
};

// Email sender settings


// Send the email verification message (Gnuboard 5 style)
export const sendEmailVerificationEmail = async (
  email: string,
  mb_id: string,
  mb_md5: string,
  locale: string = 'en',
) => {
  const t = await getTranslations({ locale, namespace: 'email' });
  const { settings, secrets } = await getNotificationConfig();
  if (!canUseLiveDelivery(settings, email, 'email')) throw new Error('개발 환경 실발송 설정 및 허용된 테스트 수신자를 확인하세요.');
  const transporter = smtpTransport(settings, secrets);

  // Use the email-verification page URL
  const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/email-certify?mb_id=${mb_id}&mb_md5=${mb_md5}`;

  const mailOptions = {
    from: settings.smtpFrom,
    to: email,
    subject: t('verifySubject'),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; text-align: center;">${t('verifySubject')}</h2>
        <p style="color: #666; line-height: 1.6;">
          ${t('verifyHello')}<br>${t('verifyMessage')}
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}"
             style="background-color: #007bff; color: white; padding: 12px 30px;
                    text-decoration: none; border-radius: 5px; display: inline-block;">
            ${t('verifyButton')}
          </a>
        </div>
        <p style="color: #999; font-size: 14px;">
          <a href="${verificationUrl}" style="color: #007bff;">${verificationUrl}</a>
        </p>
        <p style="color: #999; font-size: 12px; margin-top: 30px;">
          ${t('verifyExpiresIn24h')}<br>
          ${t('verifyIgnoreIfNotRequested')}
        </p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);

  } catch (error) {
    console.error('email verification delivery failed');
    throw new Error(t('sendFailed'));
  }
};
