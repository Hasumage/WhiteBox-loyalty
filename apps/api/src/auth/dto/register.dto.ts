import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from "class-validator";

export class RegisterDto {
  @ApiProperty({ example: "Jane Doe" })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ example: "jane@example.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "Str0ngP@ss", minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({
    enum: UserRole,
    description:
      "Defaults to CLIENT. COMPANY for partner portals. ADMIN cannot be self-registered.",
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
