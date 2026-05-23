import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class TelegramMiniAppLoginDto {
  @ApiProperty({
    description: "Raw Telegram Mini App initData string from window.Telegram.WebApp.initData",
  })
  @IsString()
  @MinLength(1)
  initData!: string;
}
