import { getPaymentReceiptUrl } from "@/lib/finance/payment-receipts";

describe("payment receipt links", () => {
  it("reads receipt url from payment metadata first", () => {
    expect(
      getPaymentReceiptUrl({
        metadata: { receiptUrl: "https://ofd.example/check/123" },
        providerPayload: { receipt: { url: "https://ofd.example/check/provider" } },
      }),
    ).toBe("https://ofd.example/check/123");
  });

  it("finds nested provider receipt links", () => {
    expect(
      getPaymentReceiptUrl({
        providerPayload: {
          payment: {
            fiscalization: {
              receipt: {
                check_url: "https://ofd.example/receipt/456",
              },
            },
          },
        },
      }),
    ).toBe("https://ofd.example/receipt/456");
  });

  it("ignores unrelated links", () => {
    expect(getPaymentReceiptUrl({ metadata: { supportUrl: "https://example.com/help" } })).toBeNull();
  });
});
