import { HuntModerationStatus, HuntPostStatus } from "@prisma/client";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

export class ModerateHuntPostDto {
  @IsOptional()
  @IsEnum(HuntPostStatus)
  status?: HuntPostStatus;

  @IsOptional()
  @IsEnum(HuntModerationStatus)
  moderationStatus?: HuntModerationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  note?: string;
}

