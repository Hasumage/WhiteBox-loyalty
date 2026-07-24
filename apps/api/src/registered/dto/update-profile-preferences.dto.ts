import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsOptional } from "class-validator";

export class UpdateProfilePreferencesDto {
  @ApiPropertyOptional({ enum: ["PRIVATE", "FRIENDS", "PUBLIC"] })
  @IsOptional()
  @IsIn(["PRIVATE", "FRIENDS", "PUBLIC"])
  profileVisibility?: "PRIVATE" | "FRIENDS" | "PUBLIC";

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  marketingOptIn?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  showActivityStats?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  browserNotificationsEnabled?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  geoNotificationsEnabled?: boolean;
}
