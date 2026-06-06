import { ApiPropertyOptional } from "@nestjs/swagger";
import { CompanyReferralPipelineStatus, CompanyReferralStatus } from "@prisma/client";
import { IsEnum, IsNumber, IsOptional, IsString, Max, Min, MinLength } from "class-validator";

export class UpsertCompanyReferralDto {
  @ApiPropertyOptional({ example: 12, description: "User id that receives referral commission for this company." })
  @IsOptional()
  @IsNumber()
  @Min(1)
  referrerUserId?: number;

  @ApiPropertyOptional({ example: 1, description: "Percent of recognized subscription turnover paid from the WhiteBox share." })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(12)
  referralPercent?: number;

  @ApiPropertyOptional({ enum: CompanyReferralStatus, example: CompanyReferralStatus.ACTIVE })
  @IsOptional()
  @IsEnum(CompanyReferralStatus)
  status?: CompanyReferralStatus;

  @ApiPropertyOptional({ enum: CompanyReferralPipelineStatus, example: CompanyReferralPipelineStatus.REVENUE_ACTIVE })
  @IsOptional()
  @IsEnum(CompanyReferralPipelineStatus)
  pipelineStatus?: CompanyReferralPipelineStatus;

  @ApiPropertyOptional({ example: "PR", description: "Referral source label." })
  @IsOptional()
  @IsString()
  @MinLength(2)
  source?: string;

  @ApiPropertyOptional({ example: "Introduced company during May pilot." })
  @IsOptional()
  @IsString()
  notes?: string;
}
