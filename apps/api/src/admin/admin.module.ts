import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AdminController } from "./admin.controller";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AdminService } from "./admin.service";
import { EmailModule } from "../email/email.module";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule, ConfigModule, EmailModule],
  controllers: [AdminController],
  providers: [RolesGuard, AdminService],
})
export class AdminModule {}
