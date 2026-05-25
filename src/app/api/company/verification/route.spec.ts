jest.mock("@/lib/auth/require-user-session", () => ({
  requireUserSession: jest.fn(),
  isUserAuthResponse: (value: unknown) => value instanceof Response,
}));

jest.mock("@/lib/company-onboarding/company-applications", () => ({
  parseCompanyApplicationPayload: jest.fn(),
  createExistingCompanyVerificationApplication: jest.fn(),
  notifyAdminsAboutCompanyApplication: jest.fn(),
}));

jest.mock("@/lib/company-onboarding/passport-storage", () => ({
  encryptAndStorePassportUpload: jest.fn(),
  deletePassportStorageFile: jest.fn(),
}));

import { NextRequest } from "next/server";
import { requireUserSession } from "@/lib/auth/require-user-session";
import {
  createExistingCompanyVerificationApplication,
  notifyAdminsAboutCompanyApplication,
  parseCompanyApplicationPayload,
} from "@/lib/company-onboarding/company-applications";
import { POST } from "./route";

const mockedRequireUserSession = jest.mocked(requireUserSession);
const mockedParsePayload = jest.mocked(parseCompanyApplicationPayload);
const mockedCreateApplication = jest.mocked(createExistingCompanyVerificationApplication);
const mockedNotifyAdmins = jest.mocked(notifyAdminsAboutCompanyApplication);

function fullApplicationForm() {
  const form = new FormData();
  // A forged legacy value must be overwritten by the API.
  form.set("identityVerificationMode", "DEFERRED");
  form.set("employmentType", "SELF_EMPLOYED");
  form.set("businessCategory", "Coffee");
  form.set("legalFirstName", "Max");
  form.set("legalLastName", "Owner");
  form.set("birthDate", "2000-01-01");
  form.set("legalInn", "123456789012");
  form.set("passportSeries", "1234");
  form.set("passportNumber", "567890");
  form.set("passportIssuedAt", "2020-01-01");
  form.set("passportIssuedBy", "Test department");
  form.set("passportPhoto", new File(["photo"], "passport.jpg", { type: "image/jpeg" }));
  form.set("consentAccepted", "on");
  return form;
}

describe("company verification request route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRequireUserSession.mockResolvedValue({ userId: 41, email: "owner@test.local", role: "COMPANY" });
    mockedParsePayload.mockReturnValue({ identityVerificationMode: "FULL" } as never);
    mockedCreateApplication.mockResolvedValue({ application: { uuid: "request-1" } } as never);
    mockedNotifyAdmins.mockResolvedValue({ sent: 2, admins: 2 });
  });

  it("submits an existing company request and notifies administrators", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/company/verification", {
        method: "POST",
        body: fullApplicationForm(),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockedParsePayload).toHaveBeenCalledWith(
      expect.objectContaining({ consentAccepted: true, identityVerificationMode: "FULL" }),
      { existingCompany: true },
    );
    expect(mockedCreateApplication).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 41, ipAddress: "unknown" }),
    );
    expect(mockedNotifyAdmins).toHaveBeenCalledWith("request-1");
    expect(body.applicationUuid).toBe("request-1");
  });

  it("does not let a non-company account submit verification", async () => {
    mockedRequireUserSession.mockResolvedValue({ userId: 5, email: "client@test.local", role: "CLIENT" });

    const response = await POST(
      new NextRequest("http://localhost/api/company/verification", {
        method: "POST",
        body: fullApplicationForm(),
      }),
    );

    expect(response.status).toBe(403);
    expect(mockedCreateApplication).not.toHaveBeenCalled();
  });

  it("returns a conflict when the company already has an open request", async () => {
    mockedCreateApplication.mockRejectedValue(new Error("A verification request is already being reviewed."));

    const response = await POST(
      new NextRequest("http://localhost/api/company/verification", {
        method: "POST",
        body: fullApplicationForm(),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.message).toBe("У компании уже есть заявка на рассмотрении.");
  });
});
