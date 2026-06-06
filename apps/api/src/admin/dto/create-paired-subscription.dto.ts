import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMinSize,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { MAX_SUBSCRIPTION_PRICE_RUB, MIN_SUBSCRIPTION_PRICE_RUB } from "../../subscriptions/subscription-limits";

export class PairedSubscriptionParticipantDto {
  @ApiProperty({ example: 12 })
  @IsInt()
  @Min(1)
  companyId!: number;

  @ApiProperty({ example: "Coffee welcome box" })
  @IsString()
  @MinLength(2)
  benefitTitle!: string;

  @ApiProperty({ example: "Provides roasted coffee packs and personal tasting notes." })
  @IsString()
  @MinLength(5)
  benefitDescription!: string;

  @ApiPropertyOptional({ example: "Ships within 3 business days after activation." })
  @IsOptional()
  @IsString()
  fulfillmentNote?: string;

  @ApiProperty({ example: 50 })
  @IsNumber()
  @Min(0)
  @Max(100)
  revenueSharePercent!: number;
}

export class CreatePairedSubscriptionDto {
  @ApiProperty({ example: "Coffee & Fitness Club" })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ example: "One subscription combining coffee delivery and weekly studio access." })
  @IsString()
  @MinLength(5)
  description!: string;

  @ApiProperty({ example: 1990, minimum: MIN_SUBSCRIPTION_PRICE_RUB, maximum: MAX_SUBSCRIPTION_PRICE_RUB })
  @IsNumber()
  @Min(MIN_SUBSCRIPTION_PRICE_RUB)
  @Max(MAX_SUBSCRIPTION_PRICE_RUB)
  price!: number;

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

  @ApiPropertyOptional({ example: "coffee-fitness-club" })
  @IsOptional()
  @IsString()
  @MinLength(2)
  slug?: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  categoryId?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ type: [PairedSubscriptionParticipantDto] })
  @ValidateNested({ each: true })
  @Type(() => PairedSubscriptionParticipantDto)
  @ArrayMinSize(2)
  participants!: PairedSubscriptionParticipantDto[];
}
