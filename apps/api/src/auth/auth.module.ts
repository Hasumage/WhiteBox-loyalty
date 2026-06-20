import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { EmailModule } from "../email/email.module";
import { JwtAuthMiddleware } from "./middleware/jwt-auth.middleware";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { LocalStrategy } from "./strategies/local.strategy";

@Module({
  imports: [
    PassportModule.register({}),
    EmailModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>("JWT_SECRET"),
        signOptions: {
          // `ms`-compatible value; cast avoids strict branded-type mismatch in @nestjs/jwt
          expiresIn: (config.get<string>("JWT_EXPIRES_IN") ?? "15m") as `${number}m` | `${number}d` | `${number}s`,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, LocalStrategy, JwtAuthMiddleware],
  exports: [AuthService, JwtModule, JwtAuthMiddleware],
})
export class AuthModule {}
