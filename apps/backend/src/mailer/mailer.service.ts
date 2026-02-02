// Provides a single place to send emails; can fall back to log-only in development but fails fast in production when misconfigured.
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';

// Typed error used to let callers distinguish expected mail delivery failures from
// unexpected exceptions. This keeps transport details out of user-facing responses
// while still surfacing actionable reasons (e.g., SES sandbox recipient not verified).
export class MailDeliveryError extends Error {
  constructor(
    public readonly reason: 'recipient_unverified' | 'transport_error',
    public readonly details?: string,
  ) {
    super(reason);
  }
}

export type MailPayload = {
  to: string;
  subject: string;
  text?: string;
  html?: string;
};

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly from: string;
  private transporter?: Transporter;
  private readonly allowLogFallback: boolean;
  private readonly hostSanitized: string | undefined;

  constructor(private readonly config: ConfigService) {
    // Prefer explicit MAILER_EMAIL; fall back to legacy EMAIL_FROM to avoid breaking existing envs.
    this.from =
      this.config.get<string>('MAILER_EMAIL') ??
      this.config.get<string>('EMAIL_FROM') ??
      'no-reply@localhost';
    // Only allow log-only fallback in dev or when explicitly enabled; prod should fail loudly to surface misconfig.
    const allowFallbackEnv = this.config.get<string>(
      'MAILER_ALLOW_LOG_FALLBACK',
    );
    const nodeEnv =
      this.config.get<string>('NODE_ENV') ??
      process.env.NODE_ENV ??
      'development';
    this.allowLogFallback = allowFallbackEnv
      ? allowFallbackEnv === 'true'
      : nodeEnv === 'development';
    this.hostSanitized = this.sanitizeHost(
      this.config.get<string>('SMTP_HOST'),
    );
    this.transporter = this.buildTransport();
  }

  /**
   * Sends an email using SMTP when configured; otherwise logs the payload to help developers debug flows locally.
   */
  async sendMail(payload: MailPayload): Promise<void> {
    const message = {
      from: this.from,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    };

    if (!this.transporter) {
      if (!this.allowLogFallback) {
        // Fail fast in production so misconfigurations don't silently drop emails.
        throw new Error(
          'Mailer transport is not configured; set SMTP_HOST/SMTP_PORT (and MAILER_EMAIL).',
        );
      }
      this.logger.log(`DEV mail (not sent): ${JSON.stringify(message)}`);
      return;
    }

    try {
      await this.transporter.sendMail(message);
    } catch (error) {
      // Map transport-specific errors (like SES sandbox rejections) into a typed error
      // so upstream layers can return safe, actionable responses without leaking SMTP details.
      const normalized = this.normalizeMailError(error);
      this.logger.error(`Mail send failed: ${normalized.reason}`, normalized.details);
      throw new MailDeliveryError(normalized.reason, normalized.details);
    }
  }

  /**
   * Helper to send the email verification code with both text and HTML variants.
   */
  async sendVerificationCode(to: string, code: string): Promise<void> {
    const subject = 'Your ScholarXP verification code';
    const text = `Enter this code to verify your email: ${code}`;
    // Lightweight, inline-styled template that renders well in common email clients without external assets.
    const html = `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#0f172a;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="520" style="background:#0b1220;border:1px solid #1f2937;border-radius:12px;padding:28px;color:#e5e7eb;">
          <tr>
            <td style="text-align:left;">
              <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#e5e7eb;">Verify your email</p>
              <p style="margin:0 0 20px;font-size:15px;color:#cbd5e1;">Use this code to finish setting up your ScholarXP account.</p>

              <div style="display:inline-block;background:#111827;border:1px solid #1f2937;border-radius:10px;padding:14px 18px;margin:0 0 18px;">
                <span style="font-size:26px;letter-spacing:4px;font-weight:800;color:#7dd3fc;">${code}</span>
              </div>

              <p style="margin:0;font-size:12px;color:#94a3b8;">Enter this code in ScholarXP to finish verifying your account. If you didn’t request this, you can ignore this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    await this.sendMail({ to, subject, text, html });
  }

  private normalizeMailError(error: unknown): {
    reason: 'recipient_unverified' | 'transport_error';
    details: string;
  } {
    const message = error instanceof Error ? error.message : String(error);
    const responseLine = (error as { response?: string }).response ?? '';
    const combined = `${message} ${responseLine}`.toLowerCase();

    if (combined.includes('email address is not verified')) {
      return {
        reason: 'recipient_unverified',
        details: message,
      };
    }

    return {
      reason: 'transport_error',
      details: message,
    };
  }

  private buildTransport(): Transporter | undefined {
    // Strip accidental schemes/trailing slashes to avoid DNS failures (e.g., "http://smtp.example.com/").
    const host = this.hostSanitized;
    const portValue = this.config.get<string>('SMTP_PORT');
    const port = portValue ? Number(portValue) : undefined;
    if (!host || !port) {
      return undefined;
    }

    const secure =
      this.config.get<string>('SMTP_SECURE') === 'true' || port === 465;
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');

    // Nodemailer accepts undefined auth to allow unauthenticated local relays.
    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });
  }

  private sanitizeHost(raw: string | undefined): string | undefined {
    if (!raw) return undefined;
    return raw.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  }
}
