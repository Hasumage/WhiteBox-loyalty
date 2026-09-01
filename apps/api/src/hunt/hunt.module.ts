import { Module } from "@nestjs/common";
import { RolesGuard } from "../auth/guards/roles.guard";
import { PrismaModule } from "../prisma/prisma.module";
import { TelegramNotificationsModule } from "../telegram/telegram-notifications.module";
import { HuntController } from "./hunt.controller";
import { HuntService } from "./hunt.service";

@Module({
  imports: [PrismaModule, TelegramNotificationsModule],
  controllers: [HuntController],
  providers: [RolesGuard, HuntService],
})
export class HuntModule {}
