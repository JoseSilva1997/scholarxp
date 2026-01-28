// Provides a single place to send emails; falls back to log-only when SMTP is not configured so devs can test flows without real emails.
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';
import { FRONTEND_URL } from '../constants';

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

  constructor(private readonly config: ConfigService) {
    this.from = this.config.get<string>('EMAIL_FROM') ?? 'no-reply@localhost';
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
      this.logger.log(`DEV mail (not sent): ${JSON.stringify(message)}`);
      return;
    }

    await this.transporter.sendMail(message);
  }

  /**
   * Helper to send the email verification code with both text and HTML variants.
   */
  async sendVerificationCode(to: string, code: string): Promise<void> {
    const verifyUrl = `${
      this.config.get<string>('FRONTEND_URL') ?? FRONTEND_URL
    }/verify-email?code=${encodeURIComponent(code)}`;
    const subject = 'Your ScholarXP verification code';
    const text = `Enter this code to verify your email: ${code}\nOr click: ${verifyUrl}`;
    const html = `<p>Enter this code to verify your email:</p><p><strong style="font-size:20px;">${code}</strong></p><p>Or <a href="${verifyUrl}">click here</a>.</p>`;

    await this.sendMail({ to, subject, text, html });
  }

  private buildTransport(): Transporter | undefined {
    const host = this.config.get<string>('SMTP_HOST');
    const portValue = this.config.get<string>('SMTP_PORT');
    const port = portValue ? Number(portValue) : undefined;
    if (!host || !port) {
      return undefined;
    }

    const secure = this.config.get<string>('SMTP_SECURE') === 'true' || port === 465;
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
}
