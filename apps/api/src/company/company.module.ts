import { Module } from "@nestjs/common";
import { RolesGuard } from "../auth/guards/roles.guard";
import { PrismaModule } from "../prisma/prisma.module";
import { CompanyController } from "./company.controller";
import { CompanyService } from "./company.service";

@Module({
  imports: [PrismaModule],
  controllers: [CompanyController],
  providers: [RolesGuard, CompanyService],
})
export class CompanyModule {}
