import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

class CompanyLevelRuleInputDto {
  @ApiProperty({ example: "Silver" })
  @IsString()
  @MinLength(2)
  levelName!: string;

  @ApiProperty({ example: 1000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minTotalSpend!: number;

  @ApiProperty({ example: 5 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cashbackPercent!: number;
}

export class UpsertCompanyProfileDto {
  @ApiProperty({ example: "Acme Fitness Club" })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({ example: "acme-fitness-club" })
  @IsOptional()
  @IsString()
  @MinLength(2)
  slug?: string;

  @ApiPropertyOptional({ example: "Premium gym and fitness services" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 1, description: "Primary category id (legacy single-select)" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId?: number;

  @ApiPropertyOptional({
    example: [1, 4],
    description: "Company categories (multi-select). First item becomes primary category.",
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  categoryIds?: number[];

  @ApiPropertyOptional({ example: 120 })
  @IsOptional()
  @IsInt()
  @Min(1)
  pointsPerReward?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: "Whether the company works online or by delivery without physical public locations.",
  })
  @IsOptional()
  @IsBoolean()
  operatesOnline?: boolean;

  @ApiPropertyOptional({
    example: "INCLUDE_NO_BONUS",
    enum: ["EXCLUDE", "INCLUDE_NO_BONUS", "INCLUDE_WITH_BONUS"],
    description: "How subscription payments impact level spend and bonuses",
  })
  @IsOptional()
  @IsString()
  @IsIn(["EXCLUDE", "INCLUDE_NO_BONUS", "INCLUDE_WITH_BONUS"])
  subscriptionSpendPolicy?: "EXCLUDE" | "INCLUDE_NO_BONUS" | "INCLUDE_WITH_BONUS";

  @ApiPropertyOptional({
    type: [CompanyLevelRuleInputDto],
    example: [
      { levelName: "Bronze", minTotalSpend: 0, cashbackPercent: 1 },
      { levelName: "Silver", minTotalSpend: 1000, cashbackPercent: 3 },
      { levelName: "Gold", minTotalSpend: 10000, cashbackPercent: 7 },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompanyLevelRuleInputDto)
  levelRules?: CompanyLevelRuleInputDto[];
}
