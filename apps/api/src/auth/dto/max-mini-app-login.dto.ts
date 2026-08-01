import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class MaxMiniAppLoginDto {
  @ApiProperty({
    description: "Raw MAX mini-app initData string",
  })
  @IsString()
  @MinLength(1)
  initData!: string;
}
