import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "../prisma/prisma.module";
import { TelegramNotificationsService } from "./telegram-notifications.service";

@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [TelegramNotificationsService],
  exports: [TelegramNotificationsService],
})
export class TelegramNotificationsModule {}
