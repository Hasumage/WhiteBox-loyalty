export type EmailProviderInput = {
  from: string;
  toEmail: string;
  toName?: string | null;
  subject: string;
  text: string;
  html?: string | null;
};

export type EmailProviderResult = {
  provider: string;
  messageId?: string | null;
};

export interface EmailProvider {
  readonly name: string;
  isConfigured(): boolean;
  send(input: EmailProviderInput): Promise<EmailProviderResult>;
}

export function formatEmailAddress(email: string, name?: string | null) {
  const trimmedEmail = email.trim();
  const trimmedName = name?.trim();
  if (!trimmedName) return trimmedEmail;
  const safeName = trimmedName.replace(/"/g, '\\"');
  return `"${safeName}" <${trimmedEmail}>`;
}
