import { Module } from "@nestjs/common";
import { RolesGuard } from "../auth/guards/roles.guard";
import { PaymentsModule } from "../payments/payments.module";
import { PrismaModule } from "../prisma/prisma.module";
import { CompanyController } from "./company.controller";
import { CompanyAiLocationsService } from "./ai-locations/company-ai-locations.service";
import { CompanyAiService } from "./company-ai.service";
import { CompanyService } from "./company.service";

@Module({
  imports: [PrismaModule, PaymentsModule],
  controllers: [CompanyController],
  providers: [RolesGuard, CompanyService, CompanyAiService, CompanyAiLocationsService],
})
export class CompanyModule {}
