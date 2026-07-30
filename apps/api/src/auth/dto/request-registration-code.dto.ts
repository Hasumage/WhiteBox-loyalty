import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { IsBoolean, IsEmail, IsEnum, IsIn, IsOptional, IsString, Length, MinLength } from "class-validator";

export class RequestRegistrationCodeDto {
  @ApiProperty({ example: "Max Pastukhov" })
  @IsString()
  @Length(2, 120)
  name!: string;

  @ApiProperty({ example: "max@example.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  confirmPassword!: string;

  @ApiPropertyOptional({ enum: UserRole, default: UserRole.CLIENT })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ enum: ["ru", "en"], default: "ru" })
  @IsOptional()
  @IsIn(["ru", "en"])
  locale?: "ru" | "en";

  @ApiProperty({
    example: true,
    description: "Must be true: the user accepted NearLoy user terms before account creation.",
  })
  @IsBoolean()
  termsAccepted!: boolean;

  @ApiPropertyOptional({
    example: true,
    description: "Allows the public B2B career page to create a MANAGER account with PR permissions after email verification.",
  })
  @IsOptional()
  @IsBoolean()
  prManagerCareer?: boolean;
}
