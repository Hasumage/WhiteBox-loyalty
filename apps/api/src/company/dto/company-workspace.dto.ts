import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { CompanyMemberRole, SubscriptionEntitlementWindow } from "@prisma/client";
import { IsBoolean, IsEmail, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

export class AwardCompanyPointsDto {
  @ApiProperty({ example: "whitebox-user-uuid" })
  @IsString()
  @MinLength(4)
  userUuid!: string;

  @ApiProperty({ enum: ["MANUAL", "PURCHASE"], example: "PURCHASE" })
  @IsIn(["MANUAL", "PURCHASE"])
  mode!: "MANUAL" | "PURCHASE";

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  points?: number;

  @ApiPropertyOptional({ example: 1000 })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(10_000_000)
  purchaseAmount?: number;

  @ApiPropertyOptional({ example: "Покупка на кассе" })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  description?: string;
}

export class CreateCompanyMemberDto {
  @ApiProperty({ example: "Анна Кассирова" })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: "cashier@example.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "Temporary123", minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ enum: [CompanyMemberRole.MANAGER, CompanyMemberRole.CASHIER] })
  @IsEnum(CompanyMemberRole)
  role!: CompanyMemberRole;
}

export class UpdateCompanyMemberRoleDto {
  @ApiProperty({ enum: [CompanyMemberRole.MANAGER, CompanyMemberRole.CASHIER] })
  @IsEnum(CompanyMemberRole)
  role!: CompanyMemberRole;
}

export class UpdateCompanyMemberStatusDto {
  @ApiProperty({ example: false })
  @IsBoolean()
  isActive!: boolean;
}

export class RequestCompanyPayoutDto {
  @ApiProperty({ example: 25000 })
  @IsNumber()
  @Min(1)
  amount!: number;

  @ApiPropertyOptional({ example: "Выплата за май" })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string;
}

export class CreateSubscriptionEntitlementDto {
  @ApiProperty({ example: "Кофе дня" })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title!: string;

  @ApiPropertyOptional({ example: "Любой горячий напиток до 350 мл" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  @Max(1000)
  allowance!: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  @Max(365)
  windowValue!: number;

  @ApiProperty({ enum: SubscriptionEntitlementWindow, example: SubscriptionEntitlementWindow.DAY })
  @IsEnum(SubscriptionEntitlementWindow)
  windowUnit!: SubscriptionEntitlementWindow;
}

export class RedeemSubscriptionEntitlementDto {
  @ApiProperty({ example: "whitebox-user-uuid" })
  @IsString()
  @MinLength(4)
  userUuid!: string;

  @ApiProperty({ example: "entitlement-uuid" })
  @IsString()
  @MinLength(4)
  entitlementUuid!: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  quantity?: number;

  @ApiPropertyOptional({ example: "Выдано на кассе" })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  note?: string;
}
