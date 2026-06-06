import { BadRequestException, Body, Controller, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { CurrentUser, type RequestUser } from "../auth/decorators/current-user.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { UpdateFavoriteCategoriesDto } from "./dto/update-favorite-categories.dto";
import { RedeemCodeDto } from "./dto/redeem-code.dto";
import { UpdateProfilePreferencesDto } from "./dto/update-profile-preferences.dto";
import { RegisteredService } from "./registered.service";

/**
 * TWA client–only API surface (same audience as Home / Map / History / Profile).
 * `JwtAuthMiddleware` + **CLIENT** role only.
 */
@ApiTags("registered")
@ApiBearerAuth("access-token")
@Controller("registered")
@UseGuards(RolesGuard)
@Roles(UserRole.CLIENT)
export class RegisteredController {
  constructor(private readonly registeredService: RegisteredService) {}

  @Get("profile")
  @ApiOperation({ summary: "Example route for any logged-in user" })
  profile(@CurrentUser() user: RequestUser) {
    return this.registeredService.profile(user.userId);
  }

  @Post("onboarding/complete")
  @ApiOperation({ summary: "Mark first-run onboarding as completed" })
  completeOnboarding(@CurrentUser() user: RequestUser) {
    return this.registeredService.completeOnboarding(user.userId);
  }

  @Post("onboarding/skip")
  @ApiOperation({ summary: "Skip first-run onboarding" })
  skipOnboarding(@CurrentUser() user: RequestUser) {
    return this.registeredService.skipOnboarding(user.userId);
  }

  @Put("profile/preferences")
  @ApiBody({ type: UpdateProfilePreferencesDto })
  @ApiOperation({ summary: "Update current user's profile privacy/preferences" })
  updateProfilePreferences(@CurrentUser() user: RequestUser, @Body() dto: UpdateProfilePreferencesDto) {
    return this.registeredService.updateProfilePreferences(user.userId, dto);
  }

  @Get("referral")
  @ApiOperation({ summary: "Current user's referral code and campaign settings" })
  referral(@CurrentUser() user: RequestUser) {
    return this.registeredService.referralStatus(user.userId);
  }

  @Post("referral/redeem")
  @ApiBody({ type: RedeemCodeDto })
  @ApiOperation({ summary: "Redeem a friend's referral code" })
  redeemReferral(@CurrentUser() user: RequestUser, @Body() dto: RedeemCodeDto) {
    return this.registeredService.redeemReferralCode(user.userId, dto.code);
  }

  @Post("promo/redeem")
  @ApiBody({ type: RedeemCodeDto })
  @ApiOperation({ summary: "Redeem promo code for bonus points or subscription activation" })
  redeemPromo(@CurrentUser() user: RequestUser, @Body() dto: RedeemCodeDto) {
    return this.registeredService.redeemPromoCode(user.userId, dto.code);
  }

  @Get("categories")
  @ApiOperation({
    summary: "List available categories with favorite flag for current user",
  })
  categories(@CurrentUser() user: RequestUser) {
    return this.registeredService.listCategories(user.userId);
  }

  @Get("favorite-categories")
  @ApiOperation({ summary: "Get favorite categories (slug list) for current user" })
  favoriteCategories(@CurrentUser() user: RequestUser) {
    return this.registeredService.listFavoriteCategorySlugs(user.userId);
  }

  @Put("favorite-categories")
  @ApiBody({ type: UpdateFavoriteCategoriesDto })
  @ApiOperation({ summary: "Replace favorite categories for current user" })
  setFavoriteCategories(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateFavoriteCategoriesDto,
  ) {
    return this.registeredService.replaceFavoriteCategories(user.userId, dto.categorySlugs);
  }

  @Get("dashboard")
  @ApiOperation({ summary: "TWA dashboard data from database" })
  dashboard(@CurrentUser() user: RequestUser) {
    return this.registeredService.dashboard(user.userId);
  }

  @Get("marketplace")
  @ApiOperation({ summary: "TWA marketplace categories and active subscription plans" })
  @ApiQuery({ name: "category", required: false, type: String })
  marketplace(@CurrentUser() user: RequestUser, @Query("category") category?: string) {
    return this.registeredService.marketplace(user.userId, category);
  }

  @Get("companies")
  @ApiOperation({ summary: "TWA partner companies with user points and level progress" })
  companies(@CurrentUser() user: RequestUser) {
    return this.registeredService.listCompanies(user.userId);
  }

  @Get("wallet")
  @ApiOperation({ summary: "TWA wallet cards and total point balance" })
  wallet(@CurrentUser() user: RequestUser) {
    return this.registeredService.wallet(user.userId);
  }

  @Get("qr")
  @ApiOperation({ summary: "Current user's QR payload" })
  qr(@CurrentUser() user: RequestUser) {
    return this.registeredService.userQr(user.userId);
  }

  @Post("lookup-code")
  @ApiOperation({ summary: "Generate a short-lived five digit cashier lookup code" })
  lookupCode(@CurrentUser() user: RequestUser) {
    return this.registeredService.createCustomerLookupCode(user.userId);
  }

  @Get("history")
  @ApiOperation({ summary: "TWA operation history and archived subscriptions" })
  history(@CurrentUser() user: RequestUser) {
    return this.registeredService.history(user.userId);
  }

  @Get("subscriptions/active")
  @ApiOperation({ summary: "Current user's active subscriptions" })
  activeSubscriptions(@CurrentUser() user: RequestUser) {
    return this.registeredService.listActiveSubscriptions(user.userId);
  }

  @Get("subscriptions/archive")
  @ApiOperation({ summary: "Current user's expired and canceled subscriptions" })
  archivedSubscriptions(@CurrentUser() user: RequestUser) {
    return this.registeredService.listArchivedSubscriptions(user.userId);
  }

  @Post("subscriptions/:uuid/activate")
  @ApiOperation({ summary: "Deprecated direct activation endpoint. Use registered/payments/subscriptions/:uuid/checkout." })
  activateSubscription(@CurrentUser() user: RequestUser, @Param("uuid") uuid: string) {
    void user;
    void uuid;
    throw new BadRequestException("Direct subscription activation is disabled. Create a payment checkout first.");
  }
}
