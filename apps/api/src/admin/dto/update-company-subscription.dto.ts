import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min, MinLength } from "class-validator";
import { MAX_SUBSCRIPTION_PRICE_RUB } from "../../subscriptions/subscription-limits";

export class UpdateCompanySubscriptionDto {
  @ApiPropertyOptional({ example: "Monthly Unlimited" })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({ example: "Unlimited access to all classes" })
  @IsOptional()
  @IsString()
  @MinLength(5)
  description?: string;

  @ApiPropertyOptional({ example: 49.99, maximum: MAX_SUBSCRIPTION_PRICE_RUB })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(MAX_SUBSCRIPTION_PRICE_RUB)
  price?: number;

  @ApiPropertyOptional({ example: "month", description: "Legacy combined period label" })
  @IsOptional()
  @IsString()
  @MinLength(2)
  renewalPeriod?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  renewalValue?: number;

  @ApiPropertyOptional({ example: "month", enum: ["week", "month", "year"] })
  @IsOptional()
  @IsString()
  @IsIn(["week", "month", "year"])
  renewalUnit?: "week" | "month" | "year";

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  promoBonusDays?: number;

  @ApiPropertyOptional({ example: "2026-05-01T23:59:59.000Z" })
  @IsOptional()
  @IsString()
  promoEndsAt?: string | null;

  @ApiPropertyOptional({ example: "monthly-unlimited" })
  @IsOptional()
  @IsString()
  @MinLength(2)
  slug?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  categoryId?: number;
}
