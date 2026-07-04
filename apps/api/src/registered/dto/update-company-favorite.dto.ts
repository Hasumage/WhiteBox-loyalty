import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class UpdateCompanyFavoriteDto {
  @ApiProperty({
    example: true,
    description: "Whether the current user marks this company as favorite.",
  })
  @IsBoolean()
  isFavorite!: boolean;
}
