import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsIn, IsOptional } from "class-validator";

export class RequestPasswordResetDto {
  @ApiProperty({ example: "client@example.com" })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ enum: ["ru", "en"], default: "ru" })
  @IsOptional()
  @IsIn(["ru", "en"])
  locale?: "ru" | "en";
}
