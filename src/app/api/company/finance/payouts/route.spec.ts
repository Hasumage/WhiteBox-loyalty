jest.mock("@/lib/finance/company-payout-notifications", () => ({
  notifyAdminsAboutCompanyPayout: jest.fn(),
}));

import { NextRequest } from "next/server";
import { notifyAdminsAboutCompanyPayout } from "@/lib/finance/company-payout-notifications";
import { POST } from "./route";

const mockedNotifyAdmins = jest.mocked(notifyAdminsAboutCompanyPayout);

describe("company payout notification gateway", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:3001/api";
    mockedNotifyAdmins.mockResolvedValue({ sent: 1, admins: 1 });
  });

  it("forwards a successful payout request and notifies admins", async () => {
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ uuid: "payout-1", status: "PENDING_APPROVAL" }), { status: 201 }),
    );

    const response = await POST(
      new NextRequest("http://localhost/api/company/finance/payouts", {
        method: "POST",
        headers: { Authorization: "Bearer token" },
        body: JSON.stringify({ amount: 5000 }),
      }),
    );

    expect(response.status).toBe(201);
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:3001/api/company/finance/payouts",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer token" }) }),
    );
    expect(mockedNotifyAdmins).toHaveBeenCalledWith("payout-1");
    fetchSpy.mockRestore();
  });

  it("does not notify admins when payout creation is rejected", async () => {
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Insufficient earned balance" }), { status: 400 }),
    );

    const response = await POST(
      new NextRequest("http://localhost/api/company/finance/payouts", {
        method: "POST",
        headers: { Authorization: "Bearer token" },
        body: JSON.stringify({ amount: 5000 }),
      }),
    );

    expect(response.status).toBe(400);
    expect(mockedNotifyAdmins).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
