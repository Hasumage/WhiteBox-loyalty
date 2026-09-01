import { IsArray, IsInt, IsLatitude, IsLongitude, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

export class CreateHuntPostDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  placeName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  district?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  categorySlug?: string;

  @IsString()
  @MinLength(12)
  @MaxLength(1400)
  caption!: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  photoUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mediaUrls?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsString()
  @MaxLength(24)
  visitPriceBand?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  moodTags?: string[];

  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5000)
  locationAccuracy?: number;
}
