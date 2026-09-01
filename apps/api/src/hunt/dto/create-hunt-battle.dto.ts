import { IsOptional, IsUUID } from "class-validator";

export class CreateHuntBattleDto {
  @IsOptional()
  @IsUUID()
  cardUuid?: string;
}
