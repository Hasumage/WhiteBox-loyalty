import { Body, Controller, Delete, Get, Post, Query, Redirect, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { CurrentUser, type RequestUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { VkIdService } from "./vkid.service";

type VkIdSessionBody = {
  ticket?: string;
};

type VkIdLinkBody = {
  next?: string;
};

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function loginContextFromRequest(req: Request) {
  const forwardedFor = req.headers["x-forwarded-for"];
  const ipAddress = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor?.split(",")[0]?.trim() || req.ip || null;
  return {
    ipAddress,
    countryCode: headerValue(req.headers["cf-ipcountry"]) ?? headerValue(req.headers["x-country-code"]) ?? null,
    city: headerValue(req.headers["x-city"]) ?? null,
    userAgent: req.headers["user-agent"] ?? null,
    deviceLabel: headerValue(req.headers["sec-ch-ua-platform"]) ?? headerValue(req.headers["x-device-label"]) ?? null,
    requestId: headerValue(req.headers["x-request-id"]) ?? null,
  };
}

@ApiTags("oauth")
@Controller("oauth")
export class OAuthController {
  constructor(private readonly vkid: VkIdService) {}

  @Get("providers")
  @ApiOperation({ summary: "Available OAuth providers" })
  providers() {
    return {
      providers: [
        {
          id: "vkid",
          label: "VK ID",
          enabled: this.vkid.isEnabled(),
          trustedRedirectUrl: this.vkid.trustedRedirectUrl(),
          startUrl: "/oauth/vkid/start",
        },
      ],
    };
  }

  @Get("vkid/start")
  @Redirect()
  @ApiOperation({ summary: "Start VK ID Authorization Code + PKCE flow" })
  async startVkId(@Req() req: Request, @Query("next") next?: string) {
    return {
      url: await this.vkid.createAuthorizationRedirect({
        next,
        ctx: loginContextFromRequest(req),
      }),
    };
  }

  @Post("vkid/link/start")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("access-token")
  @ApiBody({ schema: { type: "object", properties: { next: { type: "string" } } } })
  @ApiOperation({ summary: "Start VK ID linking for current NearLoy account" })
  async startVkIdLink(@Req() req: Request, @CurrentUser() user: RequestUser, @Body() body: VkIdLinkBody) {
    return {
      url: await this.vkid.createAuthorizationRedirect({
        next: body.next,
        linkUserId: user.userId,
        ctx: loginContextFromRequest(req),
      }),
    };
  }

  @Get("vkid/status")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Current account VK ID linking status" })
  vkIdStatus(@CurrentUser() user: RequestUser) {
    return this.vkid.status(user.userId);
  }

  @Delete("vkid/link")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Unlink VK ID from current account when password and regular email exist" })
  unlinkVkId(@CurrentUser() user: RequestUser) {
    return this.vkid.unlink(user.userId);
  }

  @Get("vkid/callback")
  @Redirect()
  @ApiOperation({ summary: "VK ID OAuth callback" })
  async vkIdCallback(
    @Req() req: Request,
    @Query("code") code?: string,
    @Query("state") state?: string,
    @Query("device_id") deviceId?: string,
  ) {
    return {
      url: await this.vkid.handleCallback({
        code,
        state,
        deviceId,
        ctx: loginContextFromRequest(req),
      }),
    };
  }

  @Post("vkid/session")
  @ApiBody({ schema: { type: "object", properties: { ticket: { type: "string" } }, required: ["ticket"] } })
  @ApiOperation({ summary: "Exchange one-time VK ID login ticket for NearLoy tokens" })
  consumeVkIdTicket(@Body() body: VkIdSessionBody) {
    return this.vkid.consumeTicket(body.ticket ?? "");
  }
}
