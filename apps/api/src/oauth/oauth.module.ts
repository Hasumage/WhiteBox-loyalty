import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { OAuthController } from "./oauth.controller";
import { VkIdService } from "./vkid.service";

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [OAuthController],
  providers: [VkIdService],
})
export class OAuthModule {}
