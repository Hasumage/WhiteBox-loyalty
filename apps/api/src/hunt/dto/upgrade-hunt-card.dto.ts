import { IsIn, IsOptional, IsUUID } from "class-validator";

export const HUNT_CARD_STAT_KEYS = ["health", "attack", "luck", "evasion"] as const;
export type HuntCardStatKey = (typeof HUNT_CARD_STAT_KEYS)[number];

export class UpgradeHuntCardDto {
  @IsOptional()
  @IsUUID()
  cardUuid?: string;

  @IsOptional()
  @IsIn(HUNT_CARD_STAT_KEYS)
  focusStat?: HuntCardStatKey;
}

export class ApplyHuntCardUpgradeBonusDto {
  @IsUUID()
  upgradeUuid!: string;

  @IsIn(HUNT_CARD_STAT_KEYS)
  focusStat!: HuntCardStatKey;
}
