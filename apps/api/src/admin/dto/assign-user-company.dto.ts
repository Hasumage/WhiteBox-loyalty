import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { CompanyMemberRole } from "@prisma/client";
import { IsBoolean, IsEnum, IsInt, IsOptional } from "class-validator";

export enum AdminCompanyAssignmentMode {
  CREATE_NEW = "CREATE_NEW",
  ATTACH_EXISTING = "ATTACH_EXISTING",
}

export class AssignUserCompanyDto {
  @ApiProperty({ enum: AdminCompanyAssignmentMode })
  @IsEnum(AdminCompanyAssignmentMode)
  mode!: AdminCompanyAssignmentMode;

  @ApiPropertyOptional({
    description: "Required when mode is ATTACH_EXISTING.",
    example: 12,
  })
  @IsOptional()
  @IsInt()
  companyId?: number;

  @ApiPropertyOptional({
    enum: CompanyMemberRole,
    description: "Role inside selected company. OWNER transfers ownership.",
    example: CompanyMemberRole.MANAGER,
  })
  @IsOptional()
  @IsEnum(CompanyMemberRole)
  memberRole?: CompanyMemberRole;

  @ApiPropertyOptional({
    description: "Deactivate other active company memberships for this user before attaching.",
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  deactivatePreviousMemberships?: boolean;
}
