import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class UpdateUserProfileDto {
  @ApiPropertyOptional({
    description: "User birth date in YYYY-MM-DD format. Pass null or an empty string to clear it.",
    example: "1995-04-21",
    nullable: true,
  })
  @IsOptional()
  @IsString()
  birthDate?: string | null;
}
