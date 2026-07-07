import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, Length, MinLength } from "class-validator";

export class ConfirmPasswordResetDto {
  @ApiProperty({ example: "client@example.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "169435" })
  @IsString()
  @Length(6, 6)
  code!: string;

  @ApiProperty({ minLength: 8, example: "new-password-123" })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ minLength: 8, example: "new-password-123" })
  @IsString()
  @MinLength(8)
  confirmPassword!: string;
}
