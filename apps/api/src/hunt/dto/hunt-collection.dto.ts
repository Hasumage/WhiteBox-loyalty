import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class HuntCollectionDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1000000)
  page = 1;

  @IsOptional() @IsIn(["rarity", "level", "name", "element", "newest"])
  sort: "rarity" | "level" | "name" | "element" | "newest" = "rarity";

  @IsOptional() @IsIn(["all", "FLAME", "WATER", "NATURE", "WIND", "MUSIC", "LIGHT", "SHADOW"])
  element = "all";

  @IsOptional() @IsIn(["ru", "en"])
  locale: "ru" | "en" = "ru";

  @IsOptional() @IsString() @MaxLength(100)
  query = "";
}
