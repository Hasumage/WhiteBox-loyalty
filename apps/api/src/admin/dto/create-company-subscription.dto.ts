import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { SubscriptionEntitlementWindow } from "@prisma/client";
import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from "class-validator";
import { MAX_SUBSCRIPTION_PRICE_RUB, MIN_SUBSCRIPTION_PRICE_RUB } from "../../subscriptions/subscription-limits";

export class CreateCompanySubscriptionEntitlementDto {
  @ApiProperty({ example: "Coffee of the day" })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title!: string;

  @ApiPropertyOptional({ example: "Any hot drink up to 350 ml." })
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

export class CreateCompanySubscriptionDto {
  @ApiProperty({ example: "Monthly Unlimited" })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ example: "Unlimited access to all classes" })
  @IsString()
  @MinLength(5)
  description!: string;

  @ApiProperty({ example: 299, minimum: MIN_SUBSCRIPTION_PRICE_RUB, maximum: MAX_SUBSCRIPTION_PRICE_RUB })
  @IsNumber()
  @Min(MIN_SUBSCRIPTION_PRICE_RUB)
  @Max(MAX_SUBSCRIPTION_PRICE_RUB)
  price!: number;

  @ApiPropertyOptional({ example: "month", description: "Legacy combined period label" })
  @IsOptional()
  @IsString()
  @MinLength(2)
  renewalPeriod?: string;

  @ApiPropertyOptional({ example: 1, description: "Base renewal length value (e.g. 3 months => 3)" })
  @IsOptional()
  @IsInt()
  @Min(1)
  renewalValue?: number;

  @ApiPropertyOptional({ example: "month", enum: ["week", "month", "year"] })
  @IsOptional()
  @IsString()
  @IsIn(["week", "month", "year"])
  renewalUnit?: "week" | "month" | "year";

  @ApiPropertyOptional({ example: 10, description: "Promo bonus days added while promo is active" })
  @IsOptional()
  @IsInt()
  @Min(0)
  promoBonusDays?: number;

  @ApiPropertyOptional({ example: "2026-05-01T23:59:59.000Z" })
  @IsOptional()
  @IsString()
  promoEndsAt?: string;

  @ApiPropertyOptional({ example: "monthly-unlimited" })
  @IsOptional()
  @IsString()
  @MinLength(2)
  slug?: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  categoryId?: number;

  @ApiProperty({ type: [CreateCompanySubscriptionEntitlementDto], description: "At least one service must be created with company-owned subscriptions." })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateCompanySubscriptionEntitlementDto)
  entitlements!: CreateCompanySubscriptionEntitlementDto[];
}
