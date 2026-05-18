import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString, Matches, Max, Min, MinLength } from "class-validator";

export class UpsertCompanyLocationDto {
  @ApiPropertyOptional({ example: "Main entrance" })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ example: "Moscow, Tverskaya street, 7" })
  @IsString()
  @MinLength(5)
  address!: string;

  @ApiPropertyOptional({ example: "Moscow" })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 55.755864, description: "Manual map picker latitude. If provided with longitude, geocoding is skipped." })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ example: 37.617698, description: "Manual map picker longitude. If provided with latitude, geocoding is skipped." })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isMain?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: "09:00" })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  openTime?: string;

  @ApiPropertyOptional({ example: "21:00" })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  closeTime?: string;

  @ApiPropertyOptional({ example: [1, 2, 3, 4, 5], description: "0 is Sunday, 1 is Monday." })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  workingDays?: number[];
}
