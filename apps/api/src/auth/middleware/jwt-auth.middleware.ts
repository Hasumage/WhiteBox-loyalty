import {
  Injectable,
  NestMiddleware,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { UserRole } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { PrismaService } from "../../prisma/prisma.service";
import type { JwtPayload } from "../strategies/jwt.strategy";

/**
 * Validates `Authorization: Bearer <token>`, verifies JWT, attaches `req.user`.
 * Returns 401 JSON if token is missing or invalid.
 *
 * Use via `MiddlewareConsumer` for routes that must be authenticated (NestJS pattern;
 * functionally equivalent to applying JwtAuthGuard on every handler).
 */
@Injectable()
export class JwtAuthMiddleware implements NestMiddleware {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    const token =
      typeof authHeader === "string" && authHeader.startsWith("Bearer ")
        ? authHeader.slice(7).trim()
        : null;

    if (!token) {
      return res.status(401).json({
        statusCode: 401,
        message: "Unauthorized",
        error: "Missing or invalid Authorization header (expected Bearer token)",
      });
    }

    try {
      const secret = this.config.getOrThrow<string>("JWT_SECRET");
      const payload = this.jwt.verify<JwtPayload>(token, { secret });
      const user = await this.prisma.user.findUnique({
        where: { id: Number(payload.sub) },
        select: {
          id: true,
          email: true,
          role: true,
          accountStatus: true,
        },
      });
      if (!user) {
        return res.status(401).json({
          statusCode: 401,
          message: "Unauthorized",
          error: "User not found",
        });
      }
      if (user.accountStatus === "BLOCKED") {
        return res.status(423).json({
          statusCode: 423,
          message: "Account blocked",
          error: "This account is blocked by an administrator",
        });
      }
      req.user = {
        userId: user.id,
        email: user.email,
        role: user.role as UserRole,
      };
      next();
    } catch {
      return res.status(401).json({
        statusCode: 401,
        message: "Unauthorized",
        error: "Invalid or expired token",
      });
    }
  }
}
