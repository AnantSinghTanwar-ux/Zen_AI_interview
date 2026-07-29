// ─── Transactional Email Service (Brevo) ────────────────────────────────────
//
// Handles automated interview invitation emails using Brevo (formerly Sendinblue).
// Designed to be called from BullMQ workers with rate limiting.
//
// Setup:
//   1. Sign up at https://brevo.com
//   2. Set BREVO_API_KEY, BREVO_SENDER_EMAIL, and BREVO_SENDER_NAME in .env

const BREVO_API_KEY = process.env.BREVO_API_KEY || "";
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || "tanwaranantsingh10@gmail.com";
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || "ZenAI";
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

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
        Congratulations! You've been shortlisted for the position of
        <strong style="color: #c4b5fd;">${escapeHtml(params.jobTitle)}</strong> at
        <strong style="color: #c4b5fd;">${escapeHtml(params.companyName)}</strong>.
      </p>

      <p style="color: #a1a1aa; font-size: 15px; line-height: 1.7; margin: 0 0 32px;">
        We'd like to invite you to complete an AI-powered interview at your convenience.
        Click the button below to start when you're ready.
      </p>

      <!-- CTA Button -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${escapeHtml(params.interviewLink)}"
           style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #ffffff; padding: 16px 40px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 16px; letter-spacing: 0.3px; box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);">
          Start Your Interview →
        </a>
      </div>

      <!-- Details Box -->
      <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 20px 24px; margin: 24px 0;">
        <div style="color: #71717a; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">
          Interview Details
        </div>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="color: #71717a; font-size: 14px; padding: 6px 0;">Position</td>
            <td style="color: #e4e4e7; font-size: 14px; padding: 6px 0; text-align: right;">${escapeHtml(params.jobTitle)}</td>
          </tr>
          <tr>
            <td style="color: #71717a; font-size: 14px; padding: 6px 0;">Company</td>
            <td style="color: #e4e4e7; font-size: 14px; padding: 6px 0; text-align: right;">${escapeHtml(params.companyName)}</td>
          </tr>
          <tr>
            <td style="color: #71717a; font-size: 14px; padding: 6px 0;">Type</td>
            <td style="color: #e4e4e7; font-size: 14px; padding: 6px 0; text-align: right;">AI-Powered Interview</td>
          </tr>
          <tr>
            <td style="color: #71717a; font-size: 14px; padding: 6px 0;">Deadline</td>
            <td style="color: #f87171; font-size: 14px; padding: 6px 0; text-align: right; font-weight: 600;">${escapeHtml(params.deadline)}</td>
          </tr>
        </table>
      </div>

      <p style="color: #71717a; font-size: 13px; line-height: 1.6; margin: 24px 0 0;">
        💡 <strong style="color: #a1a1aa;">Tips:</strong> Find a quiet space, ensure stable internet,
        and have your webcam/mic ready. The interview typically takes 15-30 minutes.
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
 * Send an interview invitation email via Brevo API.
 *
 * Uses raw fetch() instead of the Brevo SDK to minimize
 * dependency footprint and give full control over error handling.
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
    const response = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: BREVO_SENDER_NAME,
          email: BREVO_SENDER_EMAIL,
        },
        to: [
          {
            email: params.to,
            name: params.candidateName,
          },
        ],
        subject: `Interview Invitation: ${params.jobTitle} at ${params.companyName}`,
        htmlContent: buildInterviewInviteHTML(params),
        textContent: buildInterviewInvitePlainText(params),
        tags: ["interview-invite"],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return {
        success: false,
        emailId: null,
        error: `Brevo API error ${response.status}: ${errorBody}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      emailId: data.messageId || null,
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
 *
 * For high-volume sends (200+ emails), this should be called from
 * the BullMQ email worker which handles its own rate limiting.
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
