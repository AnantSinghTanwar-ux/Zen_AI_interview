import nodemailer from "nodemailer";

// ─── Transactional Email Service (Brevo via SMTP) ───────────────────────────
//
// Handles automated interview invitation emails using Brevo SMTP relay.
// Using SMTP via nodemailer is often more reliable than HTTP API and
// perfectly handles the user's specific Brevo setup.
//
// Setup:
//   1. Sign up at https://brevo.com
//   2. Get SMTP keys from Brevo dashboard
//   3. Set BREVO_API_KEY, BREVO_SENDER_EMAIL, and BREVO_SENDER_NAME in .env

const BREVO_API_KEY = process.env.BREVO_API_KEY || "";
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || "tanwaranantsingh10@gmail.com";
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || "ZenAI";

interface SendEmailParams {
  to: string;
  candidateName: string;
  jobTitle: string;
  companyName: string;
  interviewLink: string;
  deadline: string;
}

interface SendEmailResult {
  success: boolean;
  emailId: string | null;
  error: string | null;
}

/**
 * Check if Brevo is configured.
 */
export function hasBrevoKey(): boolean {
  return Boolean(BREVO_API_KEY);
}

// Initialize Nodemailer transporter with Brevo SMTP
const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: BREVO_SENDER_EMAIL,
    pass: BREVO_API_KEY, // Brevo uses the API key (or specific SMTP key) as the password for SMTP relay
  },
});

/**
 * Build the HTML email template for interview invitations.
 * Professional, mobile-responsive design.
 */
function buildInterviewInviteHTML(params: SendEmailParams): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Interview Invitation</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f0f14; font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px;">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%); padding: 40px 32px; border-radius: 20px 20px 0 0; text-align: center;">
      <div style="font-size: 28px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">
        ZenAI
      </div>
      <div style="font-size: 14px; color: rgba(255,255,255,0.8); margin-top: 8px; letter-spacing: 2px; text-transform: uppercase;">
        Interview Invitation
      </div>
    </div>

    <!-- Body -->
    <div style="background: #1a1a24; padding: 40px 32px; border: 1px solid rgba(255,255,255,0.06); border-top: none;">

      <p style="color: #e4e4e7; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
        Hi <strong style="color: #ffffff;">${escapeHtml(params.candidateName)}</strong>,
      </p>

      <p style="color: #a1a1aa; font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
        Congratulations! After reviewing your application, we are excited to invite you to the next stage of our interview process for the <strong style="color: #e4e4e7;">${escapeHtml(params.jobTitle)}</strong> position at <strong style="color: #e4e4e7;">${escapeHtml(params.companyName)}</strong>.
      </p>

      <div style="background: rgba(99, 102, 241, 0.1); border-left: 4px solid #8b5cf6; padding: 20px; border-radius: 0 8px 8px 0; margin: 0 0 32px;">
        <h3 style="color: #ffffff; margin: 0 0 12px; font-size: 16px;">AI-Powered Interview</h3>
        <p style="color: #a1a1aa; font-size: 14px; margin: 0; line-height: 1.6;">
          This will be an interactive, AI-driven technical interview designed to assess your skills objectively. You can take this interview at any time before the deadline.
        </p>
      </div>

      <div style="text-align: center; margin: 40px 0;">
        <a href="${params.interviewLink}" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; padding: 16px 36px; border-radius: 12px; box-shadow: 0 8px 20px rgba(99, 102, 241, 0.3);">
          Start Your Interview
        </a>
      </div>

      <div style="background: rgba(255,255,255,0.03); border-radius: 12px; padding: 24px; margin: 0 0 24px;">
        <div style="margin-bottom: 12px;">
          <span style="color: #71717a; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Deadline</span>
          <div style="color: #ef4444; font-size: 15px; font-weight: 600; margin-top: 4px;">
            ${escapeHtml(params.deadline)}
          </div>
        </div>
        <div>
          <span style="color: #71717a; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Duration</span>
          <div style="color: #e4e4e7; font-size: 15px; font-weight: 500; margin-top: 4px;">
            ~15-30 minutes
          </div>
        </div>
      </div>

      <p style="color: #a1a1aa; font-size: 14px; line-height: 1.6; margin: 0;">
        <strong>Preparation Tips:</strong> Ensure you are in a quiet environment with a stable internet connection. We recommend using a desktop/laptop browser with a working microphone and camera.
      </p>

    </div>

    <!-- Footer -->
    <div style="background: #13131a; padding: 24px 32px; border-radius: 0 0 20px 20px; border: 1px solid rgba(255,255,255,0.06); border-top: none; text-align: center;">
      <p style="color: #52525b; font-size: 12px; margin: 0; line-height: 1.6;">
        This is an automated message from ZenAI. Please do not reply to this email.
        <br/>If you believe you received this in error, please disregard.
      </p>
      <p style="color: #3f3f46; font-size: 11px; margin: 12px 0 0;">
        © ${new Date().getFullYear()} ZenAI. All rights reserved.
      </p>
    </div>

  </div>
</body>
</html>`;
}

/**
 * Build a plain-text fallback for email clients that don't render HTML.
 */
function buildInterviewInvitePlainText(params: SendEmailParams): string {
  return `Hi ${params.candidateName},

Congratulations! You've been shortlisted for the position of ${params.jobTitle} at ${params.companyName}.

We'd like to invite you to complete an AI-powered interview at your convenience.

Start your interview here: ${params.interviewLink}

Interview Details:
- Position: ${params.jobTitle}
- Company: ${params.companyName}
- Type: AI-Powered Interview
- Deadline: ${params.deadline}

Tips: Find a quiet space, ensure stable internet, and have your webcam/mic ready. The interview typically takes 15-30 minutes.

---
This is an automated message from ZenAI. Please do not reply.
© ${new Date().getFullYear()} ZenAI. All rights reserved.`;
}

/**
 * Escape HTML special characters to prevent XSS in email templates.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Send an interview invitation email via Brevo SMTP (nodemailer).
 */
export async function sendInterviewInviteEmail(
  params: SendEmailParams
): Promise<SendEmailResult> {
  if (!BREVO_API_KEY) {
    return {
      success: false,
      emailId: null,
      error: "BREVO_API_KEY is not configured",
    };
  }

  try {
    const info = await transporter.sendMail({
      from: `"${BREVO_SENDER_NAME}" <${BREVO_SENDER_EMAIL}>`,
      to: params.to,
      subject: `Interview Invitation: ${params.jobTitle} at ${params.companyName}`,
      text: buildInterviewInvitePlainText(params),
      html: buildInterviewInviteHTML(params),
    });

    return {
      success: true,
      emailId: info.messageId || null,
      error: null,
    };
  } catch (err) {
    return {
      success: false,
      emailId: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Send a batch of interview invitation emails.
 * Processes sequentially with a configurable delay to respect rate limits.
 */
export async function sendBatchEmails(
  emails: SendEmailParams[],
  delayBetweenMs: number = 80,
  onProgress?: (sent: number, failed: number, total: number) => void
): Promise<{ sent: number; failed: number; errors: string[] }> {
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const email of emails) {
    const result = await sendInterviewInviteEmail(email);

    if (result.success) {
      sent++;
    } else {
      failed++;
      errors.push(`${email.to}: ${result.error}`);
    }

    onProgress?.(sent, failed, emails.length);

    // Rate limiting delay
    if (delayBetweenMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, delayBetweenMs));
    }
  }

  return { sent, failed, errors };
}
