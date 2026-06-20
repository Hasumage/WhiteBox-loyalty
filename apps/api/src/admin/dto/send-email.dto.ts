import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsEnum, IsOptional, IsString, IsUUID, Length } from "class-validator";

export enum AdminEmailTargetType {
  USER = "USER",
  COMPANY = "COMPANY",
  DIRECT = "DIRECT",
}

export class SendEmailDto {
  @ApiProperty({ enum: AdminEmailTargetType })
  @IsEnum(AdminEmailTargetType)
  targetType!: AdminEmailTargetType;

  @ApiPropertyOptional({ description: "User UUID for USER or company-owner user UUID for COMPANY." })
  @IsOptional()
  @IsUUID()
  targetUuid?: string;

  @ApiPropertyOptional({ example: "client@example.com" })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: "NearLoy update" })
  @IsString()
  @Length(3, 160)
  subject!: string;

  @ApiProperty({ example: "Hello! We have an update for you." })
  @IsString()
  @Length(1, 5000)
  message!: string;
}
