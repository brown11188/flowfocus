import nodemailer from "nodemailer";

// ─── SMTP Transporter ─────────────────────────────────────────────────────────
function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error(
      "SMTP is not configured. Please set SMTP_HOST, SMTP_USER, SMTP_PASS environment variables."
    );
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });
}

// ─── Send OTP Email ────────────────────────────────────────────────────────────
export async function sendPasswordResetOtp({
  to,
  name,
  otp,
}: {
  to: string;
  name: string | null;
  otp: string;
}): Promise<void> {
  const transporter = createTransporter();
  const fromName = process.env.SMTP_FROM_NAME ?? "FlowFocus";
  const fromEmail = process.env.SMTP_FROM_EMAIL ?? process.env.SMTP_USER ?? "no-reply@flowfocus.app";
  const displayName = name ?? "there";

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your FlowFocus password</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#7c3aed,#6366f1);padding:32px 40px;text-align:center;">
              <div style="display:inline-flex;align-items:center;gap:10px;">
                <div style="width:40px;height:40px;background:rgba(255,255,255,0.2);border-radius:10px;display:inline-flex;align-items:center;justify-content:center;">
                  <span style="font-size:20px;">⚡</span>
                </div>
                <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">FlowFocus</span>
              </div>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#111827;">Reset your password</h1>
              <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">Hi ${displayName}, use the OTP code below to reset your FlowFocus password.</p>

              <!-- OTP Box -->
              <div style="background:#f5f3ff;border:2px solid #7c3aed;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
                <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#7c3aed;letter-spacing:1px;text-transform:uppercase;">Your OTP Code</p>
                <p style="margin:0;font-size:40px;font-weight:800;color:#111827;letter-spacing:12px;font-family:'Courier New',monospace;">${otp}</p>
              </div>

              <!-- Warning -->
              <div style="background:#fef3c7;border-radius:8px;padding:14px 16px;margin-bottom:24px;display:flex;align-items:flex-start;gap:8px;">
                <span style="font-size:16px;">⏱️</span>
                <p style="margin:0;font-size:13px;color:#92400e;line-height:1.5;">This code expires in <strong>10 minutes</strong>. You have <strong>3 attempts</strong> before it is invalidated.</p>
              </div>

              <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.5;">If you did not request a password reset, you can safely ignore this email. Your password will not change.</p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;">
              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">© ${new Date().getFullYear()} FlowFocus. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject: `${otp} is your FlowFocus password reset code`,
    html,
    text: `Hi ${displayName},\n\nYour FlowFocus password reset OTP is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you did not request this, ignore this email.`,
  });
}
