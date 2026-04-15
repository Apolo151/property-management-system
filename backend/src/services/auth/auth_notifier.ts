/**
 * Out-of-band delivery for password reset. Logs by default; extend with SMTP when configured.
 */
export async function sendPasswordResetEmail(email: string, plainToken: string): Promise<void> {
  const base =
    process.env.PASSWORD_RESET_PUBLIC_URL ||
    process.env.FRONTEND_URL ||
    'http://localhost:5173';
  const link = `${base.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(plainToken)}`;

  if (process.env.SMTP_HOST && process.env.SMTP_FROM) {
    console.warn(
      '[auth_notifier] SMTP_HOST is set but nodemailer is not wired; log-only reset link for',
      email,
    );
  }

  console.info(`[auth_notifier] Password reset for ${email}: ${link}`);
}
