import {
  authenticatedDestination,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  refreshStoredSession,
} from "./auth-client";

function mockBrowserStorage() {
  const values = new Map<string, string>();
  Object.defineProperty(global, "window", {
    configurable: true,
    value: { location: { protocol: "http:" } },
  });
  Object.defineProperty(global, "document", {
    configurable: true,
    value: { cookie: "" },
  });
  Object.defineProperty(global, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  });
  return values;
}

describe("auth client session restoration", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    Reflect.deleteProperty(global, "window");
    Reflect.deleteProperty(global, "document");
    Reflect.deleteProperty(global, "localStorage");
  });

  it("uses workspace routes for restored staff and company sessions", () => {
    expect(authenticatedDestination({ role: "SUPER_ADMIN" }, "/map")).toBe("/admin");
    expect(authenticatedDestination({ role: "SUPPORT" }, "/admin")).toBe("/admin/support");
    expect(authenticatedDestination({ role: "COMPANY" }, "/map")).toBe("/company");
    expect(authenticatedDestination({ role: "CLIENT" }, "/map")).toBe("/map");
    expect(authenticatedDestination({ role: "CLIENT" }, "//external.example")).toBe("/app");
    expect(authenticatedDestination({ role: "CLIENT" }, "/")).toBe("/app");
  });

  it("rotates a stored refresh token and restores the browser session", async () => {
    const values = mockBrowserStorage();
    values.set("wb_refresh_token", "saved-refresh-token");
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        accessToken: "new-access-token",
        refreshToken: "rotated-refresh-token",
        tokenType: "Bearer",
        expiresIn: "15m",
        user: { id: "1", email: "client@test.local", name: "Client", role: "CLIENT", createdAt: "now" },
      }),
    } as Response);

    const restored = await refreshStoredSession();

    expect(restored?.accessToken).toBe("new-access-token");
    expect(getAccessToken()).toBe("new-access-token");
    expect(getRefreshToken()).toBe("rotated-refresh-token");
    expect(getStoredUser()?.email).toBe("client@test.local");
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/auth/refresh"),
      expect.objectContaining({ body: JSON.stringify({ refreshToken: "saved-refresh-token" }) }),
    );
  });

  it("clears local tokens when the stored refresh token is rejected", async () => {
    const values = mockBrowserStorage();
    values.set("wb_access_token", "expired-access-token");
    values.set("wb_refresh_token", "invalid-refresh-token");
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({ message: "Unauthorized" }),
    } as Response);

    await expect(refreshStoredSession()).resolves.toBeNull();

    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });
});
