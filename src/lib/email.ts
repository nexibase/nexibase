import nodemailer from 'nodemailer';
import crypto from 'crypto';

// 그누보드5 방식의 이메일 인증 토큰 생성 (md5 방식)
export const generateEmailVerificationToken = (): string => {
  // 그누보드5 방식: pack('V*', rand(), rand(), rand(), rand())를 md5로 해시
  const randomBytes = crypto.randomBytes(16); // 4개의 32비트 정수
  const md5Hash = crypto.createHash('md5').update(randomBytes).digest('hex');
  return md5Hash;
};

// 이메일 발송 설정
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

// 이메일 인증 메일 발송 (그누보드5 방식)
export const sendEmailVerificationEmail = async (email: string, mb_id: string, mb_md5: string) => {
  const transporter = createTransporter();
  console.log('transporter', transporter);
  // 연결이 되는지 확인?
  transporter.verify((error, success) => {
    if (error) {
      console.error('SMTP 연결 실패:', error);
    } else {
      console.log('SMTP 연결 성공:', success);
    }
  });
  
  // 이메일 인증 페이지 URL로 변경
  const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/email-certify?mb_id=${mb_id}&mb_md5=${mb_md5}`;
  
  const mailOptions = {
    from: process.env.SMTP_USER,
    to: email,
    subject: '[회원가입] 이메일 인증을 완료해주세요',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; text-align: center;">이메일 인증</h2>
        <p style="color: #666; line-height: 1.6;">
          안녕하세요! 회원가입을 완료하기 위해 이메일 인증을 진행해주세요.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" 
             style="background-color: #007bff; color: white; padding: 12px 30px; 
                    text-decoration: none; border-radius: 5px; display: inline-block;">
            이메일 인증하기
          </a>
        </div>
        <p style="color: #999; font-size: 14px;">
          위 버튼이 작동하지 않는 경우, 아래 링크를 복사하여 브라우저에 붙여넣기 해주세요:<br>
          <a href="${verificationUrl}" style="color: #007bff;">${verificationUrl}</a>
        </p>
        <p style="color: #999; font-size: 12px; margin-top: 30px;">
          이 링크는 24시간 후에 만료됩니다.
        </p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('이메일 인증 메일 발송 완료:', email);
  } catch (error) {
    console.error('이메일 발송 실패:', error);
    throw new Error('이메일 발송에 실패했습니다.');
  }
}; 