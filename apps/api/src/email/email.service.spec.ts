import { ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import { EmailService } from "./email.service";

jest.mock("nodemailer", () => ({
  createTransport: jest.fn(),
}));

function createPrismaMock() {
  return {
    emailMessage: {
      create: jest.fn().mockResolvedValue({
        id: 10,
        uuid: "email-message-uuid",
        toEmail: "client@example.com",
      }),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 10, ...data })),
    },
  };
}

function createConfigMock(values: Record<string, string | undefined> = {}) {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe("EmailService", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = fetchMock as never;
  });

  it("does not mark email as sent in production when SMTP is missing", async () => {
    const prisma = createPrismaMock();
    const service = new EmailService(
      prisma as never,
      createConfigMock({ NODE_ENV: "production" }),
    );

    await expect(
      service.sendEmail({
        toEmail: "client@example.com",
        subject: "Confirm email",
        text: "Code: 123456",
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(prisma.emailMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ provider: "dev-outbox" }),
    });
    expect(prisma.emailMessage.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: {
        status: "FAILED",
        error: "Email delivery is not configured: no requested provider is available (resend, smtp).",
      },
    });
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps dev outbox available outside deployed environments", async () => {
    const prisma = createPrismaMock();
    const service = new EmailService(prisma as never, createConfigMock());

    await expect(
      service.sendEmail({
        toEmail: "client@example.com",
        subject: "Confirm email",
        text: "Code: 123456",
      }),
    ).resolves.toEqual(expect.objectContaining({ status: "SENT" }));

    expect(prisma.emailMessage.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { status: "SENT", sentAt: expect.any(Date) },
    });
  });

  it("sends through Resend when the HTTP provider is configured", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue(JSON.stringify({ id: "resend-message-id" })),
    });
    const prisma = createPrismaMock();
    const service = new EmailService(
      prisma as never,
      createConfigMock({
        NODE_ENV: "production",
        EMAIL_PROVIDER: "resend",
        RESEND_API_KEY: "re_test_key",
        MAIL_FROM: "NearLoy <no-reply@nearloy.ru>",
      }),
    );

    await expect(
      service.sendEmail({
        toEmail: "client@example.com",
        toName: "Client User",
        subject: "Confirm email",
        text: "Code: 123456",
        html: "<p>Code: 123456</p>",
      }),
    ).resolves.toEqual(expect.objectContaining({ status: "SENT", provider: "resend" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer re_test_key",
          "Content-Type": "application/json",
        }),
      }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      from: "NearLoy <no-reply@nearloy.ru>",
      to: ['"Client User" <client@example.com>'],
      subject: "Confirm email",
      text: "Code: 123456",
      html: "<p>Code: 123456</p>",
    });
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });

  it("uses Russian registration email copy by default", async () => {
    const prisma = createPrismaMock();
    const service = new EmailService(prisma as never, createConfigMock());

    await service.sendRegistrationCode({
      toEmail: "client@example.com",
      toName: "Максим",
      code: "169435",
      expiresAt: new Date(Date.now() + 15 * 60_000),
    });

    expect(prisma.emailMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        subject: "NearLoy: код подтверждения email",
        bodyText: expect.stringContaining("Код для завершения регистрации в NearLoy: 169435"),
        bodyHtml: expect.stringContaining("Введите этот код"),
      }),
    });
  });

  it("uses English registration email copy when requested", async () => {
    const prisma = createPrismaMock();
    const service = new EmailService(prisma as never, createConfigMock());

    await service.sendRegistrationCode({
      toEmail: "client@example.com",
      toName: "Max",
      code: "169435",
      expiresAt: new Date(Date.now() + 15 * 60_000),
      locale: "en",
    });

    expect(prisma.emailMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        subject: "NearLoy: email confirmation code",
        bodyText: expect.stringContaining("Your NearLoy registration code: 169435"),
        bodyHtml: expect.stringContaining("Use this code"),
      }),
    });
  });

  it("uses English password reset email copy when requested", async () => {
    const prisma = createPrismaMock();
    const service = new EmailService(prisma as never, createConfigMock());

    await service.sendPasswordResetCode({
      toEmail: "client@example.com",
      toName: "Max",
      code: "654321",
      expiresAt: new Date(Date.now() + 15 * 60_000),
      locale: "en",
    });

    expect(prisma.emailMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        subject: "NearLoy: password reset code",
        bodyText: expect.stringContaining("Your NearLoy password reset code: 654321"),
        bodyHtml: expect.stringContaining("Use this code"),
      }),
    });
  });

  it("marks email as failed when Resend rejects the request", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 422,
      statusText: "Unprocessable Entity",
      text: jest.fn().mockResolvedValue(JSON.stringify({ message: "Domain is not verified" })),
    });
    const prisma = createPrismaMock();
    const service = new EmailService(
      prisma as never,
      createConfigMock({
        NODE_ENV: "production",
        EMAIL_PROVIDER: "resend",
        RESEND_API_KEY: "re_test_key",
        MAIL_FROM: "NearLoy <no-reply@nearloy.ru>",
      }),
    );

    await expect(
      service.sendEmail({
        toEmail: "client@example.com",
        subject: "Confirm email",
        text: "Code: 123456",
      }),
    ).rejects.toThrow("Resend email failed");

    expect(prisma.emailMessage.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: {
        status: "FAILED",
        error: "resend: Resend email failed (422): Domain is not verified",
      },
    });
  });

  it("fails when SMTP rejects recipients", async () => {
    const sendMail = jest.fn().mockResolvedValue({
      accepted: [],
      rejected: ["client@example.com"],
    });
    jest.mocked(nodemailer.createTransport).mockReturnValue({ sendMail } as never);
    const prisma = createPrismaMock();
    const service = new EmailService(
      prisma as never,
      createConfigMock({
        NODE_ENV: "production",
        SMTP_HOST: "smtp.example.com",
        SMTP_PORT: "587",
        SMTP_SECURE: "false",
        SMTP_USER: "user",
        SMTP_PASS: "pass",
      }),
    );

    await expect(
      service.sendEmail({
        toEmail: "client@example.com",
        subject: "Confirm email",
        text: "Code: 123456",
      }),
    ).rejects.toThrow("SMTP rejected recipient");

    expect(prisma.emailMessage.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: {
        status: "FAILED",
        error: "smtp: SMTP rejected recipient(s): client@example.com",
      },
    });
  });
});
