import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { CompanyMemberRole, SubscriptionEntitlementWindow, SubscriptionSpendPolicy } from "@prisma/client";
import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsBoolean, IsEmail, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from "class-validator";
import { MAX_SUBSCRIPTION_PRICE_RUB, MIN_SUBSCRIPTION_PRICE_RUB } from "../../subscriptions/subscription-limits";

export class AwardCompanyPointsDto {
  @ApiProperty({ example: "whitebox-user-uuid" })
  @IsString()
  @MinLength(4)
  userUuid!: string;

  @ApiProperty({ enum: ["MANUAL", "PURCHASE"], example: "PURCHASE" })
  @IsIn(["MANUAL", "PURCHASE"])
  mode!: "MANUAL" | "PURCHASE";

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  points?: number;

  @ApiPropertyOptional({ example: 1000 })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(10_000_000)
  purchaseAmount?: number;

  @ApiPropertyOptional({ example: "Покупка на кассе" })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  description?: string;
}

export class SpendCompanyPointsDto {
  @ApiProperty({ example: "whitebox-user-uuid" })
  @IsString()
  @MinLength(4)
  userUuid!: string;

  @ApiProperty({ example: 50 })
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  points!: number;

  @ApiPropertyOptional({ example: "Оплата покупки баллами" })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  description?: string;
}

export class LookupCompanyClientCodeDto {
  @ApiProperty({ example: "42107" })
  @IsString()
  @Matches(/^\d{5}$/, { message: "Customer code must contain exactly 5 digits." })
  code!: string;
}

export class UpdateCompanyProfileDto {
  @ApiProperty({ example: "Aurora Coffee" })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({ example: "Specialty coffee and daily rewards." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ example: false })
  @IsBoolean()
  operatesOnline!: boolean;

  @ApiProperty({ type: [Number], example: [1, 4] })
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  categoryIds!: number[];
}

export class CreateCompanyMemberDto {
  @ApiProperty({ example: "Анна Кассирова" })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: "cashier@example.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "Temporary123", minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ enum: [CompanyMemberRole.MANAGER, CompanyMemberRole.CASHIER] })
  @IsEnum(CompanyMemberRole)
  role!: CompanyMemberRole;
}

export class UpdateCompanyMemberRoleDto {
  @ApiProperty({ enum: [CompanyMemberRole.MANAGER, CompanyMemberRole.CASHIER] })
  @IsEnum(CompanyMemberRole)
  role!: CompanyMemberRole;
}

export class UpdateCompanyMemberStatusDto {
  @ApiProperty({ example: false })
  @IsBoolean()
  isActive!: boolean;
}

export class RequestCompanyPayoutDto {
  @ApiProperty({ example: 25000 })
  @IsNumber()
  @Min(5_000)
  amount!: number;

  @ApiPropertyOptional({ example: "Выплата за май" })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string;
}

export class CreateSubscriptionEntitlementDto {
  @ApiProperty({ example: "Кофе дня" })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title!: string;

  @ApiPropertyOptional({ example: "Любой горячий напиток до 350 мл" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  @Max(1000)
  allowance!: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  @Max(365)
  windowValue!: number;

  @ApiProperty({ enum: SubscriptionEntitlementWindow, example: SubscriptionEntitlementWindow.DAY })
  @IsEnum(SubscriptionEntitlementWindow)
  windowUnit!: SubscriptionEntitlementWindow;
}

export class UpdateCompanyOwnedSubscriptionDto {
  @ApiPropertyOptional({ example: "Coffee Monthly Pass" })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional({ example: "Daily coffee and weekly dessert for subscribers." })
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ example: 299, minimum: MIN_SUBSCRIPTION_PRICE_RUB, maximum: MAX_SUBSCRIPTION_PRICE_RUB })
  @IsOptional()
  @IsNumber()
  @Min(MIN_SUBSCRIPTION_PRICE_RUB)
  @Max(MAX_SUBSCRIPTION_PRICE_RUB)
  price?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(36)
  renewalValue?: number;

  @ApiPropertyOptional({ example: "month", enum: ["week", "month", "year"] })
  @IsOptional()
  @IsString()
  @IsIn(["week", "month", "year"])
  renewalUnit?: "week" | "month" | "year";

  @ApiPropertyOptional({ example: true, description: "Required when active subscribers may be affected." })
  @IsOptional()
  @IsBoolean()
  acknowledgeSubscriberRefundPolicy?: boolean;
}

export class UpdateSubscriptionEntitlementDto {
  @ApiPropertyOptional({ example: "Coffee of the day" })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional({ example: "Any hot drink up to 350 ml." })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  allowance?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  windowValue?: number;

  @ApiPropertyOptional({ enum: SubscriptionEntitlementWindow, example: SubscriptionEntitlementWindow.DAY })
  @IsOptional()
  @IsEnum(SubscriptionEntitlementWindow)
  windowUnit?: SubscriptionEntitlementWindow;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: true, description: "Required when active subscribers may be affected." })
  @IsOptional()
  @IsBoolean()
  acknowledgeSubscriberRefundPolicy?: boolean;
}

export class RedeemSubscriptionEntitlementDto {
  @ApiProperty({ example: "whitebox-user-uuid" })
  @IsString()
  @MinLength(4)
  userUuid!: string;

  @ApiProperty({ example: "entitlement-uuid" })
  @IsString()
  @MinLength(4)
  entitlementUuid!: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  quantity?: number;

  @ApiPropertyOptional({ example: "Выдано на кассе" })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  note?: string;
}

export class RedeemSubscriptionBundleBenefitDto {
  @ApiProperty({ example: "whitebox-user-uuid" })
  @IsString()
  @MinLength(4)
  userUuid!: string;

  @ApiProperty({ example: "bundle-participant-uuid" })
  @IsString()
  @MinLength(4)
  participantUuid!: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  quantity?: number;

  @ApiPropertyOptional({ example: "Выдано по парной подписке" })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  note?: string;
}

export class CreateCompanyClubBundleDto {
  @ApiProperty({ example: "Кофе + фитнес после работы" })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @ApiProperty({ example: "Одна подписка: ежедневный напиток и безлимитный проход в зал." })
  @IsString()
  @MinLength(10)
  @MaxLength(1200)
  description!: string;

  @ApiProperty({ example: 3490, minimum: MIN_SUBSCRIPTION_PRICE_RUB, maximum: MAX_SUBSCRIPTION_PRICE_RUB })
  @IsNumber()
  @Min(MIN_SUBSCRIPTION_PRICE_RUB)
  @Max(MAX_SUBSCRIPTION_PRICE_RUB)
  price!: number;

  @ApiProperty({ example: 22 })
  @IsInt()
  @Min(1)
  partnerCompanyId!: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(36)
  renewalValue?: number;

  @ApiPropertyOptional({ example: "month", enum: ["week", "month", "year"] })
  @IsOptional()
  @IsString()
  @IsIn(["week", "month", "year"])
  renewalUnit?: "week" | "month" | "year";

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  promoBonusDays?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  categoryId?: number;

  @ApiProperty({ example: "Тонизирующий напиток каждый день" })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  myBenefitTitle!: string;

  @ApiProperty({ example: "Один напиток до 350 мл каждый день." })
  @IsString()
  @MinLength(5)
  @MaxLength(800)
  myBenefitDescription!: string;

  @ApiPropertyOptional({ example: "Выдаётся на кассе кофейни." })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  myFulfillmentNote?: string;

  @ApiProperty({ example: 40 })
  @IsNumber()
  @Min(1)
  @Max(99)
  myRevenueSharePercent!: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  myAllowance?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  myWindowValue?: number;

  @ApiPropertyOptional({ enum: SubscriptionEntitlementWindow, example: SubscriptionEntitlementWindow.DAY })
  @IsOptional()
  @IsEnum(SubscriptionEntitlementWindow)
  myWindowUnit?: SubscriptionEntitlementWindow;

  @ApiProperty({ example: "Безлимитный проход в фитнес-клуб" })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  partnerBenefitTitle!: string;

  @ApiProperty({ example: "Клиент может заходить в зал без ограничения по количеству проходов." })
  @IsString()
  @MinLength(5)
  @MaxLength(800)
  partnerBenefitDescription!: string;

  @ApiPropertyOptional({ example: "Гасится на ресепшене фитнес-клуба." })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  partnerFulfillmentNote?: string;

  @ApiProperty({ example: 60 })
  @IsNumber()
  @Min(1)
  @Max(99)
  partnerRevenueSharePercent!: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  partnerAllowance?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  partnerWindowValue?: number;

  @ApiPropertyOptional({ enum: SubscriptionEntitlementWindow, example: SubscriptionEntitlementWindow.UNLIMITED })
  @IsOptional()
  @IsEnum(SubscriptionEntitlementWindow)
  partnerWindowUnit?: SubscriptionEntitlementWindow;
}

export class CompanyLevelRuleDto {
  @ApiProperty({ example: "Gold" })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  levelName!: string;

  @ApiProperty({ example: 10000 })
  @IsNumber()
  @Min(0)
  minTotalSpend!: number;

  @ApiProperty({ example: 5 })
  @IsNumber()
  @Min(0)
  @Max(100)
  cashbackPercent!: number;
}

export class UpdateCompanyLoyaltySettingsDto {
  @ApiProperty({ enum: SubscriptionSpendPolicy })
  @IsEnum(SubscriptionSpendPolicy)
  subscriptionSpendPolicy!: SubscriptionSpendPolicy;

  @ApiProperty({ type: [CompanyLevelRuleDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompanyLevelRuleDto)
  levelRules!: CompanyLevelRuleDto[];
}

export class ApplyCompanyBillingPromoDto {
  @ApiProperty({ example: "WELCOME100" })
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  code!: string;
}
