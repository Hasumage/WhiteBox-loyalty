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
  beforeEach(() => {
    jest.clearAllMocks();
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
        error: "Email delivery is not configured: no SMTP transport is available.",
      },
    });
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
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
