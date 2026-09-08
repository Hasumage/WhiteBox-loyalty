import { HuntBoxType } from "@prisma/client";
import { IsEnum, IsOptional, IsString } from "class-validator";

export class OpenHuntBoxDto {
  @IsOptional()
  @IsString()
  boxUuid?: string;

  @IsOptional()
  @IsString()
  boxConfigId?: string;

  @IsOptional()
  @IsEnum(HuntBoxType)
  boxType?: HuntBoxType;
}
