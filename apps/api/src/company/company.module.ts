import { Module } from "@nestjs/common";
import { RolesGuard } from "../auth/guards/roles.guard";
import { PaymentsModule } from "../payments/payments.module";
import { PrismaModule } from "../prisma/prisma.module";
import { CompanyController } from "./company.controller";
import { CompanyService } from "./company.service";

@Module({
  imports: [PrismaModule, PaymentsModule],
  controllers: [CompanyController],
  providers: [RolesGuard, CompanyService],
})
export class CompanyModule {}
