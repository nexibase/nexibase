import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/prisma';

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
export const sendEmailVerificationEmail = async (
  email: string,
  mb_id: string,
  mb_md5: string,
  locale: string = 'en',
) => {
  const t = await getTranslations({ locale, namespace: 'email' });
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
    console.log('이메일 인증 메일 발송 완료:', email);
  } catch (error) {
    console.error('이메일 발송 실패:', error);
    throw new Error(t('sendFailed'));
  }
};

/**
 * 쇼핑몰 이름 조회
 */
const getShopName = async (): Promise<string> => {
  try {
    const setting = await prisma.shopSetting.findUnique({
      where: { key: 'shop_name' }
    });
    return setting?.value || 'NexiBase Shop';
  } catch {
    return 'NexiBase Shop';
  }
};

/**
 * 이메일 알림 활성화 여부 확인
 */
export const isEmailNotificationEnabled = async (): Promise<boolean> => {
  try {
    const setting = await prisma.shopSetting.findUnique({
      where: { key: 'email_notification_enabled' }
    });
    return setting?.value === 'true';
  } catch {
    return false;
  }
};

/**
 * 주문 완료 이메일 발송 (고객용)
 */
export const sendOrderCompletedEmail = async (
  email: string,
  customerName: string,
  orderNo: string,
  totalAmount: number,
  items: { name: string; quantity: number; price: number }[]
) => {
  if (!await isEmailNotificationEnabled()) return;

  const shopName = await getShopName();
  const transporter = createTransporter();
  const orderUrl = `${process.env.NEXT_PUBLIC_APP_URL}/shop/orders/${orderNo}`;

  const itemsHtml = items.map(item => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.name}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}개</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${item.price.toLocaleString()}원</td>
    </tr>
  `).join('');

  const mailOptions = {
    from: process.env.SMTP_USER,
    to: email,
    subject: `[${shopName}] 주문이 완료되었습니다 (${orderNo})`,
    html: `
      <div style="font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333; border-bottom: 2px solid #333; padding-bottom: 10px;">${shopName}</h2>
        <p style="color: #666; font-size: 16px; line-height: 1.6;">
          안녕하세요, <strong>${customerName}</strong>님!<br>
          주문이 정상적으로 완료되었습니다.
        </p>

        <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #333;"><strong>주문번호:</strong> ${orderNo}</p>
          <p style="margin: 10px 0 0; color: #333;"><strong>결제금액:</strong> ${totalAmount.toLocaleString()}원</p>
        </div>

        <h3 style="color: #333; margin-top: 30px;">주문 상품</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f5f5f5;">
              <th style="padding: 10px; text-align: left;">상품명</th>
              <th style="padding: 10px; text-align: center;">수량</th>
              <th style="padding: 10px; text-align: right;">금액</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${orderUrl}"
             style="background-color: #333; color: white; padding: 12px 30px;
                    text-decoration: none; border-radius: 5px; display: inline-block;">
            주문 상세 보기
          </a>
        </div>

        <p style="color: #999; font-size: 12px; margin-top: 30px; text-align: center;">
          본 메일은 발신전용입니다.
        </p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('주문 완료 이메일 발송:', email);
  } catch (error) {
    console.error('주문 완료 이메일 발송 실패:', error);
  }
};

/**
 * 주문 상태 변경 이메일 발송 (고객용)
 */
export const sendOrderStatusEmail = async (
  email: string,
  customerName: string,
  orderNo: string,
  newStatus: string,
  trackingNumber?: string
) => {
  if (!await isEmailNotificationEnabled()) return;

  const shopName = await getShopName();
  const transporter = createTransporter();
  const orderUrl = `${process.env.NEXT_PUBLIC_APP_URL}/shop/orders/${orderNo}`;

  const statusLabels: Record<string, string> = {
    paid: '결제 완료',
    preparing: '배송 준비중',
    shipping: '배송중',
    delivered: '배송 완료',
    cancelled: '주문 취소',
    refunded: '환불 완료',
  };

  const statusMessages: Record<string, string> = {
    paid: '결제가 완료되었습니다. 곧 배송 준비를 시작합니다.',
    preparing: '상품을 준비하고 있습니다. 잠시만 기다려주세요.',
    shipping: '상품이 발송되었습니다.',
    delivered: '상품이 배송 완료되었습니다. 이용해 주셔서 감사합니다.',
    cancelled: '주문이 취소되었습니다.',
    refunded: '환불이 완료되었습니다.',
  };

  const statusLabel = statusLabels[newStatus] || newStatus;
  const statusMessage = statusMessages[newStatus] || `주문 상태가 "${statusLabel}"(으)로 변경되었습니다.`;

  let trackingHtml = '';
  if (newStatus === 'shipping' && trackingNumber) {
    trackingHtml = `
      <div style="background: #e8f4fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; color: #333;"><strong>운송장 번호:</strong> ${trackingNumber}</p>
      </div>
    `;
  }

  const mailOptions = {
    from: process.env.SMTP_USER,
    to: email,
    subject: `[${shopName}] 주문 상태 안내 - ${statusLabel} (${orderNo})`,
    html: `
      <div style="font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333; border-bottom: 2px solid #333; padding-bottom: 10px;">${shopName}</h2>
        <p style="color: #666; font-size: 16px; line-height: 1.6;">
          안녕하세요, <strong>${customerName}</strong>님!
        </p>

        <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #333;"><strong>주문번호:</strong> ${orderNo}</p>
          <p style="margin: 10px 0 0; color: #333;"><strong>주문 상태:</strong> ${statusLabel}</p>
        </div>

        <p style="color: #666; font-size: 15px; line-height: 1.6;">
          ${statusMessage}
        </p>

        ${trackingHtml}

        <div style="text-align: center; margin: 30px 0;">
          <a href="${orderUrl}"
             style="background-color: #333; color: white; padding: 12px 30px;
                    text-decoration: none; border-radius: 5px; display: inline-block;">
            주문 상세 보기
          </a>
        </div>

        <p style="color: #999; font-size: 12px; margin-top: 30px; text-align: center;">
          본 메일은 발신전용입니다.
        </p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('주문 상태 이메일 발송:', email);
  } catch (error) {
    console.error('주문 상태 이메일 발송 실패:', error);
  }
};

/**
 * 새 주문 알림 이메일 발송 (관리자용)
 */
export const sendNewOrderEmailToAdmin = async (
  adminEmail: string,
  orderNo: string,
  customerName: string,
  totalAmount: number
) => {
  if (!await isEmailNotificationEnabled()) return;

  const shopName = await getShopName();
  const transporter = createTransporter();
  const orderUrl = `${process.env.NEXT_PUBLIC_APP_URL}/admin/shop/orders/${orderNo}`;

  const mailOptions = {
    from: process.env.SMTP_USER,
    to: adminEmail,
    subject: `[${shopName}] 새 주문이 접수되었습니다 (${orderNo})`,
    html: `
      <div style="font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333; border-bottom: 2px solid #333; padding-bottom: 10px;">${shopName} - 관리자 알림</h2>

        <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <h3 style="margin: 0 0 10px; color: #856404;">🛒 새 주문 접수</h3>
          <p style="margin: 0; color: #856404;">
            <strong>${customerName}</strong>님이 새로운 주문을 접수했습니다.
          </p>
        </div>

        <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #333;"><strong>주문번호:</strong> ${orderNo}</p>
          <p style="margin: 10px 0 0; color: #333;"><strong>주문자:</strong> ${customerName}</p>
          <p style="margin: 10px 0 0; color: #333;"><strong>결제금액:</strong> ${totalAmount.toLocaleString()}원</p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${orderUrl}"
             style="background-color: #333; color: white; padding: 12px 30px;
                    text-decoration: none; border-radius: 5px; display: inline-block;">
            주문 확인하기
          </a>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('관리자 주문 알림 이메일 발송:', adminEmail);
  } catch (error) {
    console.error('관리자 주문 알림 이메일 발송 실패:', error);
  }
};

/**
 * 주문 취소 이메일 발송 (고객용)
 */
export const sendOrderCancelledEmail = async (
  email: string,
  customerName: string,
  orderNo: string,
  refundAmount: number,
  cancelReason: string
) => {
  if (!await isEmailNotificationEnabled()) return;

  const shopName = await getShopName();
  const transporter = createTransporter();
  const orderUrl = `${process.env.NEXT_PUBLIC_APP_URL}/shop/orders/${orderNo}`;

  const mailOptions = {
    from: process.env.SMTP_USER,
    to: email,
    subject: `[${shopName}] 주문이 취소되었습니다 (${orderNo})`,
    html: `
      <div style="font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333; border-bottom: 2px solid #333; padding-bottom: 10px;">${shopName}</h2>
        <p style="color: #666; font-size: 16px; line-height: 1.6;">
          안녕하세요, <strong>${customerName}</strong>님!<br>
          요청하신 주문이 취소되었습니다.
        </p>

        <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
          <h3 style="margin: 0 0 10px; color: #dc2626;">❌ 주문 취소 완료</h3>
          <p style="margin: 0; color: #333;"><strong>주문번호:</strong> ${orderNo}</p>
          <p style="margin: 10px 0 0; color: #333;"><strong>취소 사유:</strong> ${cancelReason}</p>
          <p style="margin: 10px 0 0; color: #333;"><strong>환불 금액:</strong> ${refundAmount.toLocaleString()}원</p>
        </div>

        <p style="color: #666; font-size: 14px; line-height: 1.6;">
          카드 결제의 경우 카드사에 따라 3~5 영업일 내에 환불이 진행됩니다.
        </p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${orderUrl}"
             style="background-color: #333; color: white; padding: 12px 30px;
                    text-decoration: none; border-radius: 5px; display: inline-block;">
            주문 상세 보기
          </a>
        </div>

        <p style="color: #999; font-size: 12px; margin-top: 30px; text-align: center;">
          본 메일은 발신전용입니다.
        </p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('주문 취소 이메일 발송:', email);
  } catch (error) {
    console.error('주문 취소 이메일 발송 실패:', error);
  }
};

/**
 * 주문 취소 알림 이메일 발송 (관리자용)
 */
export const sendOrderCancelledEmailToAdmin = async (
  adminEmail: string,
  orderNo: string,
  customerName: string,
  refundAmount: number,
  cancelReason: string
) => {
  if (!await isEmailNotificationEnabled()) return;

  const shopName = await getShopName();
  const transporter = createTransporter();
  const orderUrl = `${process.env.NEXT_PUBLIC_APP_URL}/admin/shop/orders/${orderNo}`;

  const mailOptions = {
    from: process.env.SMTP_USER,
    to: adminEmail,
    subject: `[${shopName}] 주문이 취소되었습니다 (${orderNo})`,
    html: `
      <div style="font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333; border-bottom: 2px solid #333; padding-bottom: 10px;">${shopName} - 관리자 알림</h2>

        <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
          <h3 style="margin: 0 0 10px; color: #dc2626;">❌ 주문 취소</h3>
          <p style="margin: 0; color: #991b1b;">
            <strong>${customerName}</strong>님의 주문이 취소되었습니다.
          </p>
        </div>

        <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #333;"><strong>주문번호:</strong> ${orderNo}</p>
          <p style="margin: 10px 0 0; color: #333;"><strong>주문자:</strong> ${customerName}</p>
          <p style="margin: 10px 0 0; color: #333;"><strong>취소 사유:</strong> ${cancelReason}</p>
          <p style="margin: 10px 0 0; color: #333;"><strong>환불 금액:</strong> ${refundAmount.toLocaleString()}원</p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${orderUrl}"
             style="background-color: #333; color: white; padding: 12px 30px;
                    text-decoration: none; border-radius: 5px; display: inline-block;">
            주문 확인하기
          </a>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('관리자 주문 취소 알림 이메일 발송:', adminEmail);
  } catch (error) {
    console.error('관리자 주문 취소 알림 이메일 발송 실패:', error);
  }
};