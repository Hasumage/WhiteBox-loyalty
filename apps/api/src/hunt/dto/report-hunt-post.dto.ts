import { HuntReportReason } from "@prisma/client";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

export class ReportHuntPostDto {
  @IsEnum(HuntReportReason)
  reason!: HuntReportReason;

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  details?: string;
}

