import { ConfigService } from "@nestjs/config";
import { EmailProvider, EmailProviderInput, EmailProviderResult, formatEmailAddress } from "../email-provider";

type ResendSendResponse = {
  id?: string;
  message?: string;
  name?: string;
};

export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";

  constructor(private readonly config: ConfigService) {}

  isConfigured() {
    return Boolean(this.getApiKey());
  }

  async send(input: EmailProviderInput): Promise<EmailProviderResult> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error("Resend API key is not configured.");
    }

    const response = await fetch(this.getApiUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: input.from,
        to: [formatEmailAddress(input.toEmail, input.toName)],
        subject: input.subject,
        text: input.text,
        ...(input.html ? { html: input.html } : {}),
      }),
    });

    const responseText = await response.text();
    const payload = this.parseResponse(responseText);

    if (!response.ok) {
      const detail = payload?.message || payload?.name || responseText || response.statusText;
      throw new Error(`Resend email failed (${response.status}): ${this.truncate(detail, 500)}`);
    }

    return {
      provider: this.name,
      messageId: payload?.id ?? null,
    };
  }

  private getApiKey() {
    return this.config.get<string>("RESEND_API_KEY")?.trim();
  }

  private getApiUrl() {
    return this.config.get<string>("RESEND_API_URL")?.trim() || "https://api.resend.com/emails";
  }

  private parseResponse(raw: string): ResendSendResponse | null {
    if (!raw.trim()) return null;
    try {
      return JSON.parse(raw) as ResendSendResponse;
    } catch {
      return null;
    }
  }

  private truncate(value: string, max: number) {
    return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
  }
}
