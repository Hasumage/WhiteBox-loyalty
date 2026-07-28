import { defaultPermissionForRole, clampPermissionToRole } from "./access-control";

describe("admin access control", () => {
  it("grants SETTINGS to admins and super admins by default", () => {
    expect(defaultPermissionForRole("SUPER_ADMIN", "SETTINGS")).toMatchObject({
      canView: true,
      canEdit: true,
      canApprove: true,
      source: "locked",
    });
    expect(defaultPermissionForRole("ADMIN", "SETTINGS")).toMatchObject({
      canView: true,
      canEdit: true,
      canApprove: true,
      source: "role",
    });
  });

  it("grants PROMOTION to admins and super admins by default", () => {
    expect(defaultPermissionForRole("SUPER_ADMIN", "PROMOTION")).toMatchObject({
      canView: true,
      canEdit: true,
      canApprove: true,
      source: "locked",
    });
    expect(defaultPermissionForRole("ADMIN", "PROMOTION")).toMatchObject({
      canView: true,
      canEdit: true,
      canApprove: true,
      source: "role",
    });
  });

  it("does not allow managers and support to receive SETTINGS or PROMOTION even through explicit permissions", () => {
    expect(defaultPermissionForRole("MANAGER", "SETTINGS")).toMatchObject({
      canView: false,
      canEdit: false,
      canApprove: false,
    });
    expect(defaultPermissionForRole("SUPPORT", "SETTINGS")).toMatchObject({
      canView: false,
      canEdit: false,
      canApprove: false,
    });
    expect(clampPermissionToRole("MANAGER", { scope: "SETTINGS", canView: true, canEdit: true })).toMatchObject({
      canView: false,
      canEdit: false,
      canApprove: false,
    });
    expect(clampPermissionToRole("SUPPORT", { scope: "SETTINGS", canView: true, canEdit: true })).toMatchObject({
      canView: false,
      canEdit: false,
      canApprove: false,
    });
    expect(clampPermissionToRole("MANAGER", { scope: "PROMOTION", canView: true, canEdit: true })).toMatchObject({
      canView: false,
      canEdit: false,
      canApprove: false,
    });
    expect(clampPermissionToRole("SUPPORT", { scope: "PROMOTION", canView: true, canEdit: true })).toMatchObject({
      canView: false,
      canEdit: false,
      canApprove: false,
    });
  });
});
