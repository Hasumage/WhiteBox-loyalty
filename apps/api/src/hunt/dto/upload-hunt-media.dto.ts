import { IsBase64, IsString, MaxLength } from "class-validator";

export class UploadHuntMediaDto {
  @IsString()
  @MaxLength(160)
  fileName!: string;

  @IsString()
  @MaxLength(80)
  contentType!: string;

  @IsBase64()
  dataBase64!: string;
}

