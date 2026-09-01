import { IsString, MaxLength, MinLength } from "class-validator";

export class GeocodeHuntAddressDto {
  @IsString()
  @MinLength(4)
  @MaxLength(240)
  address!: string;
}
