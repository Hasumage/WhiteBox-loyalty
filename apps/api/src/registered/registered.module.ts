import { Module } from "@nestjs/common";
import { RolesGuard } from "../auth/guards/roles.guard";
import { PrismaModule } from "../prisma/prisma.module";
import { RegisteredController } from "./registered.controller";
import { RegisteredService } from "./registered.service";

@Module({
  imports: [PrismaModule],
  controllers: [RegisteredController],
  providers: [RolesGuard, RegisteredService],
  exports: [RegisteredService],
})
export class RegisteredModule {}
