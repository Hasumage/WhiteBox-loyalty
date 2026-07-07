import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ArrayMaxSize, IsArray, IsEnum, IsIn, IsOptional, IsString, Matches, MaxLength, ValidateNested } from "class-validator";

export enum CompanyAiMode {
  CHAT = "CHAT",
  WORKSPACE_EDITOR = "WORKSPACE_EDITOR",
  LAUNCH_PLAN = "LAUNCH_PLAN",
  PROMOTION_DRAFT = "PROMOTION_DRAFT",
  FINANCE_EXPLAINER = "FINANCE_EXPLAINER",
  LOYALTY_ADVISOR = "LOYALTY_ADVISOR",
}

export class CompanyAiMessageDto {
  @ApiProperty({ enum: ["user", "assistant"] })
  @IsIn(["user", "assistant"])
  role!: "user" | "assistant";

  @ApiProperty({ example: "Сколько у меня активных пользователей?" })
  @IsString()
  @MaxLength(1500)
  content!: string;
}

export class CompanyAiAssistDto {
  @ApiProperty({ enum: CompanyAiMode, default: CompanyAiMode.CHAT })
  @IsEnum(CompanyAiMode)
  mode!: CompanyAiMode;

  @ApiPropertyOptional({ type: [CompanyAiMessageDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(16)
  @ValidateNested({ each: true })
  @Type(() => CompanyAiMessageDto)
  messages?: CompanyAiMessageDto[];

  @ApiPropertyOptional({ example: "Моя компания теперь называется Супер кофе." })
  @IsOptional()
  @IsString()
  @MaxLength(1500)
  prompt?: string;

  @ApiPropertyOptional({ example: "https://example.com" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  websiteUrl?: string;

  @ApiPropertyOptional({ example: "ck..." })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  activeOfferId?: string;

  @ApiPropertyOptional({ description: "Small image data URL for promotion/photo understanding." })
  @IsOptional()
  @IsString()
  @MaxLength(750_000)
  @Matches(/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/i)
  imageDataUrl?: string;

  @ApiPropertyOptional({ enum: ["ru", "en"], default: "ru" })
  @IsOptional()
  @IsIn(["ru", "en"])
  locale?: "ru" | "en";
}
