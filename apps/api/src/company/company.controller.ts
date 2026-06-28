import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { CurrentUser, type RequestUser } from "../auth/decorators/current-user.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CreateCompanySubscriptionDto } from "../admin/dto/create-company-subscription.dto";
import { UpsertCompanyLocationDto } from "../admin/dto/upsert-company-location.dto";
import { assertSubscriptionsEnabled } from "../common/subscriptions-feature";
import { PaymentsService } from "../payments/payments.service";
import { CompanyService } from "./company.service";
import {
  AwardCompanyPointsDto,
  ApplyCompanyBillingPromoDto,
  CreateCompanyClubBundleDto,
  CreateCompanyMemberDto,
  CreateSubscriptionEntitlementDto,
  LookupCompanyClientCodeDto,
  RedeemSubscriptionBundleBenefitDto,
  RedeemSubscriptionEntitlementDto,
  RequestCompanyPayoutDto,
  SpendCompanyPointsDto,
  UpdateCompanyOwnedSubscriptionDto,
  UpdateCompanyLoyaltySettingsDto,
  UpdateCompanyMemberRoleDto,
  UpdateCompanyMemberStatusDto,
  UpdateCompanyProfileDto,
  UpdateSubscriptionEntitlementDto,
} from "./dto/company-workspace.dto";

@ApiTags("company")
@ApiBearerAuth("access-token")
@Controller("company")
@UseGuards(RolesGuard)
@Roles(UserRole.COMPANY)
export class CompanyController {
  constructor(
    private readonly companyService: CompanyService,
    private readonly paymentsService: PaymentsService,
  ) {}

  @Get("profile")
  profile(@CurrentUser() user: RequestUser) {
    return this.companyService.profile(user.userId);
  }

  @Get("categories")
  categories(@CurrentUser() user: RequestUser) {
    return this.companyService.categories(user.userId);
  }

  @Patch("profile")
  updateProfile(@CurrentUser() user: RequestUser, @Body() dto: UpdateCompanyProfileDto) {
    return this.companyService.updateProfile(user.userId, dto);
  }

  @Get("locations")
  @ApiOperation({ summary: "List current company locations for the partner workspace" })
  locations(@CurrentUser() user: RequestUser) {
    return this.companyService.locations(user.userId);
  }

  @Post("locations")
  @ApiOperation({ summary: "Create company location from the partner map picker" })
  createLocation(@CurrentUser() user: RequestUser, @Body() dto: UpsertCompanyLocationDto) {
    return this.companyService.createLocation(user.userId, dto);
  }

  @Patch("locations/:uuid")
  @ApiOperation({ summary: "Update current company location" })
  updateLocation(@CurrentUser() user: RequestUser, @Param("uuid") uuid: string, @Body() dto: UpsertCompanyLocationDto) {
    return this.companyService.updateLocation(user.userId, uuid, dto);
  }

  @Delete("locations/:uuid")
  @ApiOperation({ summary: "Delete current company location" })
  deleteLocation(@CurrentUser() user: RequestUser, @Param("uuid") uuid: string) {
    return this.companyService.deleteLocation(user.userId, uuid);
  }

  @Get("dashboard")
  dashboard(@CurrentUser() user: RequestUser) {
    return this.companyService.dashboard(user.userId);
  }

  @Get("clients")
  @ApiQuery({ name: "query", required: false, type: String })
  @ApiOperation({ summary: "Search customers visible to a company cashier" })
  clients(@CurrentUser() user: RequestUser, @Query("query") query?: string) {
    return this.companyService.clients(user.userId, query);
  }

  @Get("clients/:uuid")
  client(@CurrentUser() user: RequestUser, @Param("uuid") uuid: string) {
    return this.companyService.client(user.userId, uuid);
  }

  @Post("clients/lookup-code")
  @ApiOperation({ summary: "Resolve a short-lived customer code at a company checkout" })
  lookupClientByCode(@CurrentUser() user: RequestUser, @Body() dto: LookupCompanyClientCodeDto) {
    return this.companyService.lookupClientByCode(user.userId, dto);
  }

  @Post("loyalty/award")
  award(@CurrentUser() user: RequestUser, @Body() dto: AwardCompanyPointsDto) {
    return this.companyService.awardPoints(user.userId, dto);
  }

  @Post("loyalty/spend")
  spend(@CurrentUser() user: RequestUser, @Body() dto: SpendCompanyPointsDto) {
    return this.companyService.spendPoints(user.userId, dto);
  }

  @Patch("loyalty/settings")
  updateLoyaltySettings(@CurrentUser() user: RequestUser, @Body() dto: UpdateCompanyLoyaltySettingsDto) {
    return this.companyService.updateLoyaltySettings(user.userId, dto);
  }

  @Get("team")
  team(@CurrentUser() user: RequestUser) {
    return this.companyService.team(user.userId);
  }

  @Post("team")
  createTeamMember(@CurrentUser() user: RequestUser, @Body() dto: CreateCompanyMemberDto) {
    return this.companyService.createTeamMember(user.userId, dto);
  }

  @Patch("team/:uuid/role")
  updateTeamMember(
    @CurrentUser() user: RequestUser,
    @Param("uuid") uuid: string,
    @Body() dto: UpdateCompanyMemberRoleDto,
  ) {
    return this.companyService.updateTeamMemberRole(user.userId, uuid, dto);
  }

  @Patch("team/:uuid/status")
  updateTeamMemberStatus(
    @CurrentUser() user: RequestUser,
    @Param("uuid") uuid: string,
    @Body() dto: UpdateCompanyMemberStatusDto,
  ) {
    return this.companyService.updateTeamMemberStatus(user.userId, uuid, dto);
  }

  @Get("finance")
  finance(@CurrentUser() user: RequestUser) {
    return this.companyService.finance(user.userId);
  }

  @Post("finance/payouts")
  requestPayout(@CurrentUser() user: RequestUser, @Body() dto: RequestCompanyPayoutDto) {
    return this.companyService.requestPayout(user.userId, dto);
  }

  @Get("billing")
  billing(@CurrentUser() user: RequestUser) {
    return this.companyService.billing(user.userId);
  }

  @Post("billing/promo")
  applyBillingPromo(@CurrentUser() user: RequestUser, @Body() dto: ApplyCompanyBillingPromoDto) {
    return this.companyService.applyBillingPromo(user.userId, dto);
  }

  @Post("billing/pay")
  payBillingInvoice(@CurrentUser() user: RequestUser) {
    return this.companyService.payBillingInvoice(user.userId);
  }

  @Post("billing/checkout")
  createBillingCheckout(@CurrentUser() user: RequestUser) {
    return this.paymentsService.createCompanyBillingCheckout(user.userId);
  }

  @Get("billing/payments/:uuid")
  getBillingPayment(@CurrentUser() user: RequestUser, @Param("uuid") uuid: string) {
    return this.paymentsService.getCompanyBillingPayment(user.userId, uuid);
  }

  @Get("subscriptions")
  subscriptions(@CurrentUser() user: RequestUser) {
    assertSubscriptionsEnabled();
    return this.companyService.subscriptions(user.userId);
  }

  @Post("subscriptions")
  createSubscription(@CurrentUser() user: RequestUser, @Body() dto: CreateCompanySubscriptionDto) {
    assertSubscriptionsEnabled();
    return this.companyService.createSubscription(user.userId, dto);
  }

  @Patch("subscriptions/:uuid")
  @ApiOperation({ summary: "Update a company-owned subscription with subscriber refund acknowledgement" })
  updateSubscription(
    @CurrentUser() user: RequestUser,
    @Param("uuid") uuid: string,
    @Body() dto: UpdateCompanyOwnedSubscriptionDto,
  ) {
    assertSubscriptionsEnabled();
    return this.companyService.updateSubscription(user.userId, uuid, dto);
  }

  @Post("subscriptions/:uuid/entitlements")
  createEntitlement(
    @CurrentUser() user: RequestUser,
    @Param("uuid") uuid: string,
    @Body() dto: CreateSubscriptionEntitlementDto,
  ) {
    assertSubscriptionsEnabled();
    return this.companyService.createEntitlement(user.userId, uuid, dto);
  }

  @Patch("subscriptions/:uuid/entitlements/:entitlementUuid")
  @ApiOperation({ summary: "Update a subscription benefit and usage limit with subscriber refund acknowledgement" })
  updateEntitlement(
    @CurrentUser() user: RequestUser,
    @Param("uuid") uuid: string,
    @Param("entitlementUuid") entitlementUuid: string,
    @Body() dto: UpdateSubscriptionEntitlementDto,
  ) {
    assertSubscriptionsEnabled();
    return this.companyService.updateEntitlement(user.userId, uuid, entitlementUuid, dto);
  }

  @Post("subscriptions/redemptions")
  redeemEntitlement(@CurrentUser() user: RequestUser, @Body() dto: RedeemSubscriptionEntitlementDto) {
    assertSubscriptionsEnabled();
    return this.companyService.redeemEntitlement(user.userId, dto);
  }

  @Get("club")
  @ApiOperation({ summary: "Company entrepreneur club, partner directory and collaboration bundles" })
  club(@CurrentUser() user: RequestUser) {
    return this.companyService.club(user.userId);
  }

  @Post("club/bundles")
  @ApiOperation({ summary: "Create a paired subscription proposal for another company" })
  createClubBundle(@CurrentUser() user: RequestUser, @Body() dto: CreateCompanyClubBundleDto) {
    assertSubscriptionsEnabled();
    return this.companyService.createClubBundleProposal(user.userId, dto);
  }

  @Post("club/bundles/:uuid/approve")
  @ApiOperation({ summary: "Approve current company participation in a paired subscription" })
  approveClubBundle(@CurrentUser() user: RequestUser, @Param("uuid") uuid: string) {
    assertSubscriptionsEnabled();
    return this.companyService.approveClubBundle(user.userId, uuid);
  }

  @Post("club/bundles/:uuid/reject")
  @ApiOperation({ summary: "Reject current company participation in a paired subscription" })
  rejectClubBundle(@CurrentUser() user: RequestUser, @Param("uuid") uuid: string) {
    assertSubscriptionsEnabled();
    return this.companyService.rejectClubBundle(user.userId, uuid);
  }

  @Post("club/bundles/redemptions")
  @ApiOperation({ summary: "Redeem a paired subscription benefit owned by the current company" })
  redeemClubBundleBenefit(@CurrentUser() user: RequestUser, @Body() dto: RedeemSubscriptionBundleBenefitDto) {
    assertSubscriptionsEnabled();
    return this.companyService.redeemBundleBenefit(user.userId, dto);
  }
}
