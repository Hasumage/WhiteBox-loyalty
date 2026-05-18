import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { AuditWorkspace, UserRole } from "@prisma/client";
import { Response } from "express";
import { CurrentUser, type RequestUser } from "../auth/decorators/current-user.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { AllowDuringMaintenance } from "../maintenance/allow-during-maintenance.decorator";
import { MaintenanceStateService } from "../maintenance/maintenance-state.service";
import { AdminService } from "./admin.service";
import { CreateAuditEventDto } from "./dto/create-audit-event.dto";
import { CreateBackupDto } from "./dto/create-backup.dto";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { CreateCompanySubscriptionDto } from "./dto/create-company-subscription.dto";
import { CreateAccountDto } from "./dto/create-account.dto";
import { CreatePromoCodeDto } from "./dto/create-promo-code.dto";
import { RequestEmailChangeDto } from "./dto/request-email-change.dto";
import { RestoreBackupDto } from "./dto/restore-backup.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";
import { UpdateCompanySubscriptionDto } from "./dto/update-company-subscription.dto";
import { UpdateCompanyUserDto } from "./dto/update-company-user.dto";
import { UpdateReferralCampaignDto } from "./dto/update-referral-campaign.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UpsertCompanyLocationDto } from "./dto/upsert-company-location.dto";
import { UpsertCompanyProfileDto } from "./dto/upsert-company-profile.dto";

/**
 * Admin-only API surface. Protected by:
 * - `JwtAuthMiddleware` (Bearer JWT, attaches `req.user`, 401 if invalid)
 * - `RolesGuard` + `@Roles(ADMIN)`
 */
@ApiTags("admin")
@ApiBearerAuth("access-token")
@Controller("admin")
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly maintenance: MaintenanceStateService,
  ) {}

  @Get("profile")
  @ApiOperation({ summary: "Example protected admin route" })
  profile(@CurrentUser() user: RequestUser) {
    return {
      scope: "admin",
      user,
    };
  }

  @Post("accounts")
  @ApiOperation({ summary: "Create account with selected role" })
  @ApiBody({ type: CreateAccountDto })
  createAccount(@Body() dto: CreateAccountDto) {
    return this.adminService.createAccount(dto);
  }

  @Get("users")
  @ApiOperation({ summary: "Search users/companies by role, email, name or uuid" })
  @ApiQuery({ name: "role", required: false, enum: UserRole })
  @ApiQuery({ name: "query", required: false, type: String })
  @ApiQuery({ name: "page", required: false, type: Number, example: 1 })
  @ApiQuery({ name: "limit", required: false, type: Number, example: 20 })
  @ApiQuery({ name: "sortBy", required: false, enum: ["name", "email", "role", "status", "createdAt"] })
  @ApiQuery({ name: "sortDir", required: false, enum: ["asc", "desc"] })
  listUsers(
    @Query("role") role?: UserRole,
    @Query("query") query?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("sortBy") sortBy?: "name" | "email" | "role" | "status" | "createdAt",
    @Query("sortDir") sortDir?: "asc" | "desc",
  ) {
    return this.adminService.listUsers(
      role,
      query,
      Number(page),
      Number(limit),
      sortBy ?? "createdAt",
      sortDir ?? "desc",
    );
  }

  @Patch("users/:uuid/role")
  @ApiOperation({ summary: "Update user role. ADMIN may assign MANAGER/SUPPORT; SUPER_ADMIN may assign any role." })
  @ApiBody({ type: UpdateRoleDto })
  updateUserRole(@Param("uuid") uuid: string, @Body() dto: UpdateRoleDto, @CurrentUser() actor: RequestUser) {
    return this.adminService.updateUserRole(uuid, dto.role, actor.userId);
  }

  @Get("users/:uuid")
  @ApiOperation({ summary: "Get full user profile and relations by UUID" })
  getUser(@Param("uuid") uuid: string) {
    return this.adminService.getUserByUuid(uuid);
  }

  @Patch("users/:uuid")
  @ApiOperation({ summary: "Update user fields by UUID (admin CRUD)" })
  @ApiBody({ type: UpdateUserDto })
  updateUser(@Param("uuid") uuid: string, @Body() dto: UpdateUserDto, @CurrentUser() actor: RequestUser) {
    return this.adminService.updateUserByUuid(uuid, dto, actor.userId);
  }

  @Post("users/:uuid/email-change-request")
  @ApiOperation({ summary: "Send secure email-change confirmation link to new email" })
  @ApiBody({ type: RequestEmailChangeDto })
  requestEmailChange(
    @Param("uuid") uuid: string,
    @Body() dto: RequestEmailChangeDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.adminService.requestEmailChange(uuid, actor.userId, dto.newEmail);
  }

  @Delete("users/:uuid")
  @ApiOperation({ summary: "Delete user by UUID" })
  deleteUser(@Param("uuid") uuid: string, @CurrentUser() actor: RequestUser) {
    return this.adminService.deleteUserByUuid(uuid, actor.userId);
  }

  @Post("users/:uuid/force-logout")
  @ApiOperation({ summary: "Revoke all active refresh sessions for user" })
  forceLogoutUser(@Param("uuid") uuid: string, @CurrentUser() actor: RequestUser) {
    return this.adminService.forceLogoutUserSessions(uuid, actor.userId);
  }

  @Post("users/:uuid/reactivate-account")
  @ApiOperation({ summary: "Reactivate frozen account and clear deletion schedule" })
  reactivateUserAccount(@Param("uuid") uuid: string, @CurrentUser() actor: RequestUser) {
    return this.adminService.reactivateUserAccountByUuid(uuid, actor.userId);
  }

  @Post("users/:uuid/block")
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: "Block user account, revoke refresh sessions and deny backend actions" })
  blockUserAccount(
    @Param("uuid") uuid: string,
    @Body() body: { reason?: string },
    @CurrentUser() actor: RequestUser,
  ) {
    return this.adminService.blockUserAccountByUuid(uuid, actor.userId, body?.reason);
  }

  @Get("subscriptions/stats")
  @ApiOperation({ summary: "Formal subscription statistics" })
  subscriptionStats() {
    return this.adminService.subscriptionStats();
  }

  @Get("subscriptions/:uuid")
  @ApiOperation({ summary: "Find subscription by UUID" })
  findSubscription(@Param("uuid") uuid: string) {
    return this.adminService.findSubscriptionByUuid(uuid);
  }

  @Get("promo-codes")
  @ApiOperation({ summary: "List promo codes and redemption stats" })
  listPromoCodes() {
    return this.adminService.listPromoCodes();
  }

  @Post("promo-codes")
  @ApiOperation({ summary: "Create promo code for points or subscription activation" })
  @ApiBody({ type: CreatePromoCodeDto })
  createPromoCode(@Body() dto: CreatePromoCodeDto) {
    return this.adminService.createPromoCode(dto);
  }

  @Patch("promo-codes/:id")
  @ApiOperation({ summary: "Update promo code" })
  @ApiBody({ type: CreatePromoCodeDto })
  updatePromoCode(@Param("id") id: string, @Body() dto: Partial<CreatePromoCodeDto>) {
    return this.adminService.updatePromoCode(Number(id), dto);
  }

  @Get("referral-campaign")
  @ApiOperation({ summary: "Get referral campaign rules and stats" })
  getReferralCampaign() {
    return this.adminService.getReferralCampaignAdmin();
  }

  @Patch("referral-campaign")
  @ApiOperation({ summary: "Update referral campaign rules" })
  @ApiBody({ type: UpdateReferralCampaignDto })
  updateReferralCampaign(@Body() dto: UpdateReferralCampaignDto) {
    return this.adminService.updateReferralCampaign(dto);
  }

  @Get("categories")
  @ApiOperation({ summary: "List categories" })
  listCategories() {
    return this.adminService.listCategories();
  }

  @Get("audit")
  @ApiOperation({ summary: "Audit stream with workspace/tag/search filters" })
  @ApiQuery({ name: "workspace", required: false, enum: AuditWorkspace })
  @ApiQuery({ name: "query", required: false, type: String })
  @ApiQuery({ name: "tag", required: false, type: String })
  @ApiQuery({ name: "page", required: false, type: Number, example: 1 })
  @ApiQuery({ name: "limit", required: false, type: Number, example: 40 })
  listAudit(
    @Query("workspace") workspace?: AuditWorkspace,
    @Query("query") query?: string,
    @Query("tag") tag?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.adminService.listAuditEvents({
      workspace: workspace ?? AuditWorkspace.MANAGER,
      query,
      tag,
      page: Number(page),
      limit: Number(limit),
    });
  }

  @Post("audit")
  @ApiOperation({ summary: "Create manual audit event from admin UI" })
  @ApiBody({ type: CreateAuditEventDto })
  createAudit(@Body() dto: CreateAuditEventDto, @CurrentUser() actor: RequestUser) {
    return this.adminService.createManualAuditEvent(actor.userId, dto);
  }

  @Get("backups")
  @ApiOperation({ summary: "List database snapshots" })
  listBackups() {
    return this.adminService.listBackups();
  }

  @Post("backups")
  @ApiOperation({ summary: "Create database snapshot" })
  @ApiBody({ type: CreateBackupDto, required: false })
  createBackup(@Body() dto: CreateBackupDto) {
    return this.adminService.createBackup(dto);
  }

  @Post("backups/:backupId/restore")
  @AllowDuringMaintenance()
  @ApiOperation({ summary: "Restore database snapshot (destructive action)" })
  @ApiBody({ type: RestoreBackupDto })
  async restoreBackup(
    @Param("backupId") backupId: string,
    @Body() dto: RestoreBackupDto,
    @CurrentUser() actor: RequestUser,
  ) {
    if (!dto.confirm) {
      throw new BadRequestException("Restore confirmation is required.");
    }
    this.maintenance.beginRestore({
      backupId,
      actorLabel: actor.email,
    });
    try {
      const restored = await this.adminService.restoreBackup(backupId);
      await this.adminService.createManualAuditEvent(actor.userId, {
        workspace: AuditWorkspace.MANAGER,
        category: "SYSTEM",
        level: "WARN",
        action: "Database backup restored",
        targetLabel: restored.label,
        details: `Backup ${restored.id} (${restored.kind}) restored by admin.`,
        tags: ["BACKUP", "RESTORE"],
        result: "SUCCESS",
      });
      this.maintenance.completeRestore(`Restore completed successfully: ${restored.label}`);
      return { success: true as const, restored };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown restore error";
      this.maintenance.failRestore(message);
      throw error;
    }
  }

  @Get("backups/restore-status")
  @AllowDuringMaintenance()
  @ApiOperation({ summary: "Get current database restore status" })
  restoreStatus() {
    return this.maintenance.getRestoreStatus();
  }

  @Delete("backups/:backupId")
  @ApiOperation({ summary: "Delete database snapshot" })
  deleteBackup(@Param("backupId") backupId: string) {
    return this.adminService.deleteBackup(backupId);
  }

  @Get("backups/:backupId/file")
  @ApiOperation({ summary: "Download database snapshot payload file" })
  async downloadBackup(@Param("backupId") backupId: string, @Res() res: Response) {
    const file = await this.adminService.getBackupFile(backupId);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=\"${file.fileName}\"`);
    res.send(file.content);
  }

  @Post("categories")
  @ApiOperation({ summary: "Create category" })
  @ApiBody({ type: CreateCategoryDto })
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.adminService.createCategory(dto);
  }

  @Patch("categories/:id")
  @ApiOperation({ summary: "Update category" })
  @ApiBody({ type: UpdateCategoryDto })
  updateCategory(@Param("id") id: string, @Body() dto: UpdateCategoryDto) {
    return this.adminService.updateCategory(Number(id), dto);
  }

  @Delete("categories/:id")
  @ApiOperation({ summary: "Delete category" })
  deleteCategory(@Param("id") id: string) {
    return this.adminService.deleteCategory(Number(id));
  }

  @Get("company-users")
  @ApiOperation({ summary: "List company-role users" })
  @ApiQuery({ name: "query", required: false, type: String })
  listCompanyUsers(@Query("query") query?: string) {
    return this.adminService.listCompanyUsers(query);
  }

  @Get("company-users/:uuid")
  @ApiOperation({ summary: "Get company-role user with managed company and subscriptions" })
  getCompanyUser(@Param("uuid") uuid: string) {
    return this.adminService.getCompanyUserByUuid(uuid);
  }

  @Patch("company-users/:uuid")
  @ApiOperation({ summary: "Update company-role user account data" })
  @ApiBody({ type: UpdateCompanyUserDto })
  updateCompanyUser(@Param("uuid") uuid: string, @Body() dto: UpdateCompanyUserDto) {
    return this.adminService.updateCompanyUserByUuid(uuid, dto);
  }

  @Delete("company-users/:uuid")
  @ApiOperation({ summary: "Delete company-role user" })
  deleteCompanyUser(@Param("uuid") uuid: string, @CurrentUser() actor: RequestUser) {
    return this.adminService.deleteCompanyUserByUuid(uuid, actor.userId);
  }

  @Put("company-users/:uuid/company-profile")
  @ApiOperation({ summary: "Create/update company profile for company-role user" })
  @ApiBody({ type: UpsertCompanyProfileDto })
  upsertCompanyProfile(@Param("uuid") uuid: string, @Body() dto: UpsertCompanyProfileDto) {
    return this.adminService.upsertCompanyProfile(uuid, dto);
  }

  @Get("company-users/:uuid/subscriptions")
  @ApiOperation({ summary: "List subscriptions owned by company user" })
  listCompanySubscriptions(@Param("uuid") uuid: string) {
    return this.adminService.listCompanySubscriptions(uuid);
  }

  @Post("company-users/:uuid/locations")
  @ApiOperation({ summary: "Create company location and resolve coordinates from address" })
  @ApiBody({ type: UpsertCompanyLocationDto })
  createCompanyLocation(@Param("uuid") uuid: string, @Body() dto: UpsertCompanyLocationDto) {
    return this.adminService.createCompanyLocation(uuid, dto);
  }

  @Patch("company-users/:uuid/locations/:locationUuid")
  @ApiOperation({ summary: "Update company location and re-resolve coordinates when address changes" })
  @ApiBody({ type: UpsertCompanyLocationDto })
  updateCompanyLocation(
    @Param("uuid") uuid: string,
    @Param("locationUuid") locationUuid: string,
    @Body() dto: UpsertCompanyLocationDto,
  ) {
    return this.adminService.updateCompanyLocation(uuid, locationUuid, dto);
  }

  @Delete("company-users/:uuid/locations/:locationUuid")
  @ApiOperation({ summary: "Delete company location" })
  deleteCompanyLocation(@Param("uuid") uuid: string, @Param("locationUuid") locationUuid: string) {
    return this.adminService.deleteCompanyLocation(uuid, locationUuid);
  }

  @Get("company-users/:uuid/clients")
  @ApiOperation({ summary: "List clients linked to this company with loyalty stats" })
  @ApiQuery({ name: "query", required: false, type: String })
  @ApiQuery({ name: "page", required: false, type: Number, example: 1 })
  @ApiQuery({ name: "limit", required: false, type: Number, example: 20 })
  @ApiQuery({
    name: "sortBy",
    required: false,
    enum: ["name", "email", "balance", "earned", "spent", "level", "updatedAt"],
  })
  @ApiQuery({ name: "sortDir", required: false, enum: ["asc", "desc"] })
  listCompanyClients(
    @Param("uuid") uuid: string,
    @Query("query") query?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("sortBy")
    sortBy?: "name" | "email" | "balance" | "earned" | "spent" | "level" | "updatedAt",
    @Query("sortDir") sortDir?: "asc" | "desc",
  ) {
    return this.adminService.listCompanyClients(
      uuid,
      query,
      Number(page),
      Number(limit),
      sortBy ?? "updatedAt",
      sortDir ?? "desc",
    );
  }

  @Post("company-users/:uuid/subscriptions")
  @ApiOperation({ summary: "Create subscription for company user (company required)" })
  @ApiBody({ type: CreateCompanySubscriptionDto })
  createCompanySubscription(@Param("uuid") uuid: string, @Body() dto: CreateCompanySubscriptionDto) {
    return this.adminService.createCompanySubscription(uuid, dto);
  }

  @Patch("company-users/:uuid/subscriptions/:subscriptionUuid")
  @ApiOperation({ summary: "Update company subscription" })
  @ApiBody({ type: UpdateCompanySubscriptionDto })
  updateCompanySubscription(
    @Param("uuid") uuid: string,
    @Param("subscriptionUuid") subscriptionUuid: string,
    @Body() dto: UpdateCompanySubscriptionDto,
  ) {
    return this.adminService.updateCompanySubscription(uuid, subscriptionUuid, dto);
  }

  @Delete("company-users/:uuid/subscriptions/:subscriptionUuid")
  @ApiOperation({ summary: "Delete company subscription" })
  deleteCompanySubscription(
    @Param("uuid") uuid: string,
    @Param("subscriptionUuid") subscriptionUuid: string,
  ) {
    return this.adminService.deleteCompanySubscription(uuid, subscriptionUuid);
  }
}
