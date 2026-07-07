import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class TelegramMiniAppLoginDto {
  @ApiProperty({
    description: "Raw linked client-session initData string",
  })
  @IsString()
  @MinLength(1)
  initData!: string;
}
