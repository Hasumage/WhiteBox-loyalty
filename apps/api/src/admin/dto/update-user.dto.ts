import { ApiPropertyOptional } from "@nestjs/swagger";
import { AccountStatus, CompanyMemberRole, UserRole } from "@prisma/client";
import { IsBoolean, IsEnum, IsInt, IsISO8601, IsOptional, IsString, MinLength } from "class-validator";
import { AdminCompanyAssignmentMode } from "./assign-user-company.dto";

export class UpdateUserDto {
  @ApiPropertyOptional({ example: "Jane Doe" })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({ enum: UserRole, example: UserRole.CLIENT })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ enum: AccountStatus, example: AccountStatus.ACTIVE })
  @IsOptional()
  @IsEnum(AccountStatus)
  accountStatus?: AccountStatus;

  @ApiPropertyOptional({
    nullable: true,
    description: "ISO date-time string or null",
    example: "2026-04-23T12:00:00.000Z",
  })
  @IsOptional()
  @IsISO8601()
  emailVerifiedAt?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: "ISO date-time string or null",
    example: "2026-01-01T08:00:00.000Z",
  })
  @IsOptional()
  @IsISO8601()
  createdAt?: string | null;

  @ApiPropertyOptional({
    description: "Target active company employee UUID when a company owner is moved away from COMPANY role.",
  })
  @IsOptional()
  @IsString()
  companyTransferToUserUuid?: string;

  @ApiPropertyOptional({
    description: "Explicit confirmation that the owned company may be deactivated and deleted when there is no successor.",
  })
  @IsOptional()
  @IsBoolean()
  confirmCompanyDeletion?: boolean;

  @ApiPropertyOptional({
    enum: AdminCompanyAssignmentMode,
    description: "How to prepare company workspace when user role is changed to COMPANY.",
  })
  @IsOptional()
  @IsEnum(AdminCompanyAssignmentMode)
  companyAssignmentMode?: AdminCompanyAssignmentMode;

  @ApiPropertyOptional({
    description: "Target company id for ATTACH_EXISTING company assignment.",
    example: 12,
  })
  @IsOptional()
  @IsInt()
  companyAssignmentCompanyId?: number;

  @ApiPropertyOptional({
    enum: CompanyMemberRole,
    description: "Member role in target company for ATTACH_EXISTING assignment.",
    example: CompanyMemberRole.MANAGER,
  })
  @IsOptional()
  @IsEnum(CompanyMemberRole)
  companyAssignmentMemberRole?: CompanyMemberRole;

  @ApiPropertyOptional({
    description: "Deactivate previous active company memberships when attaching to existing company.",
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  companyAssignmentDeactivatePrevious?: boolean;
}
