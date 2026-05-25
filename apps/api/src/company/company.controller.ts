import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { CurrentUser, type RequestUser } from "../auth/decorators/current-user.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CreateCompanySubscriptionDto } from "../admin/dto/create-company-subscription.dto";
import { CompanyService } from "./company.service";
import {
  AwardCompanyPointsDto,
  CreateCompanyMemberDto,
  CreateSubscriptionEntitlementDto,
  RedeemSubscriptionEntitlementDto,
  RequestCompanyPayoutDto,
  UpdateCompanyMemberRoleDto,
  UpdateCompanyMemberStatusDto,
} from "./dto/company-workspace.dto";

@ApiTags("company")
@ApiBearerAuth("access-token")
@Controller("company")
@UseGuards(RolesGuard)
@Roles(UserRole.COMPANY)
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Get("profile")
  profile(@CurrentUser() user: RequestUser) {
    return this.companyService.profile(user.userId);
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

  @Post("loyalty/award")
  award(@CurrentUser() user: RequestUser, @Body() dto: AwardCompanyPointsDto) {
    return this.companyService.awardPoints(user.userId, dto);
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

  @Get("subscriptions")
  subscriptions(@CurrentUser() user: RequestUser) {
    return this.companyService.subscriptions(user.userId);
  }

  @Post("subscriptions")
  createSubscription(@CurrentUser() user: RequestUser, @Body() dto: CreateCompanySubscriptionDto) {
    return this.companyService.createSubscription(user.userId, dto);
  }

  @Post("subscriptions/:uuid/entitlements")
  createEntitlement(
    @CurrentUser() user: RequestUser,
    @Param("uuid") uuid: string,
    @Body() dto: CreateSubscriptionEntitlementDto,
  ) {
    return this.companyService.createEntitlement(user.userId, uuid, dto);
  }

  @Post("subscriptions/redemptions")
  redeemEntitlement(@CurrentUser() user: RequestUser, @Body() dto: RedeemSubscriptionEntitlementDto) {
    return this.companyService.redeemEntitlement(user.userId, dto);
  }
}
