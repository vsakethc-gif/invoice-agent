import { Resend } from 'resend';
import { InvoiceContext } from './guardrails';

const resend = new Resend(process.env.RESEND_API_KEY || 're_mock_key');
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export interface SendEmailOptions {
  to: string;
  subject: string;
  body: string;
  context: InvoiceContext;
  businessEmail: string; // The owner's email, used as reply-to
  bcc?: string | null;   // Optional BCC to the owner
  messageId: string;     // Database ID of the message being sent
}

export async function sendEmail({
  to,
  subject,
  body,
  context,
  businessEmail,
  bcc,
  messageId,
}: SendEmailOptions) {
  // Replace newlines with <br> for HTML email
  const htmlBody = body.replace(/\n/g, '<br />');
  
  const paymentLink = context.payment_link
    ? `<div style="margin-top: 20px; margin-bottom: 20px;">
         <a href="${context.payment_link}" style="background-color: #0f172a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500;">Pay Now</a>
       </div>`
    : '';

  // 1-click action links
  const actionPaid = `${APP_URL}/api/actions/paid?invoice=${context.invoice_number}&business=${context.business_name}`;
  const actionUnsubscribe = `${APP_URL}/api/actions/unsubscribe?email=${encodeURIComponent(to)}&business=${context.business_name}`;

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #334155; line-height: 1.6;">
      <div style="margin-bottom: 32px; font-size: 16px;">
        ${htmlBody}
      </div>

      ${paymentLink}

      <div style="margin-top: 48px; padding-top: 24px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">
        <p style="margin-bottom: 16px;">
          This email was sent by <strong>${context.business_name}</strong>.
          <br />
          <span style="color: #94a3b8;">Sent via InvoiceNudge</span>
        </p>
        
        <p style="margin-bottom: 8px;">
          <a href="${actionPaid}" style="color: #64748b; text-decoration: underline;">I've already paid / stop reminders</a>
        </p>
        <p>
          <a href="${actionUnsubscribe}" style="color: #64748b; text-decoration: underline;">Unsubscribe from future reminders</a>
        </p>
      </div>
    </div>
  `;

  // Use a verified domain or Resend's free testing domain
  const fromAddress = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

  const hasRealKey = process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 'your-resend-api-key';

  if (!hasRealKey) {
    console.log(`[Email Mock (No Resend Key)] To: ${to} | Subject: ${subject}`);
    console.log(`[Email Mock] Body:\n${body}`);
    return { id: `mock-${Date.now()}`, error: null };
  }

  try {
    const data = await resend.emails.send({
      from: `${context.business_name} <${fromAddress}>`,
      replyTo: businessEmail,
      to: [to],
      ...(bcc ? { bcc: [bcc] } : {}),
      subject,
      html,
      text: body, // Fallback plain text
      tags: [
        { name: 'invoice_number', value: context.invoice_number },
        { name: 'message_id', value: messageId },
      ]
    });

    return { id: data.data?.id, error: data.error };
  } catch (error) {
    return { id: null, error };
  }
}
