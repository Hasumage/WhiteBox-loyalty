import { Body, Controller, Get, Post, Req, Res, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { User } from "@prisma/client";
import { randomBytes } from "crypto";
import type { Request, Response } from "express";
import { AuthService, type EmailRequestContext, type LoginContext } from "./auth.service";
import { CurrentUser, type RequestUser } from "./decorators/current-user.decorator";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { ConfirmEmailChangeDto } from "./dto/confirm-email-change.dto";
import { ConfirmPasswordResetDto } from "./dto/confirm-password-reset.dto";
import { LoginDto } from "./dto/login.dto";
import { MaxMiniAppLoginDto } from "./dto/max-mini-app-login.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { RegisterDto } from "./dto/register.dto";
import { RequestPasswordResetDto } from "./dto/request-password-reset.dto";
import { RequestRegistrationCodeDto } from "./dto/request-registration-code.dto";
import { TelegramMiniAppLoginDto } from "./dto/telegram-mini-app-login.dto";
import { VerifyRegistrationCodeDto } from "./dto/verify-registration-code.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";

const EMAIL_GUARD_COOKIE = "wb_email_guard";
const EMAIL_GUARD_MAX_AGE_MS = 2 * 60 * 60 * 1000;

function loginContextFromRequest(req: Request): LoginContext {
  const forwardedFor = req.headers["x-forwarded-for"];
  const ipAddress = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor?.split(",")[0]?.trim() || req.ip || null;
  return {
    ipAddress,
    countryCode:
      (req.headers["cf-ipcountry"] as string | undefined) ??
      (req.headers["x-country-code"] as string | undefined) ??
      null,
    city: (req.headers["x-city"] as string | undefined) ?? null,
    userAgent: req.headers["user-agent"] ?? null,
    deviceLabel:
      (req.headers["sec-ch-ua-platform"] as string | undefined) ??
      (req.headers["x-device-label"] as string | undefined) ??
      null,
    requestId: (req.headers["x-request-id"] as string | undefined) ?? null,
  };
}

function parseCookieHeader(header: string | undefined) {
  const result = new Map<string, string>();
  if (!header) return result;
  for (const part of header.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (!rawName || rawValue.length === 0) continue;
    try {
      result.set(rawName, decodeURIComponent(rawValue.join("=")));
    } catch {
      result.set(rawName, rawValue.join("="));
    }
  }
  return result;
}

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function cleanGuardId(value: string | null | undefined) {
  const cleaned = value?.trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
  return cleaned || null;
}

function emailRequestContextFromRequest(req: Request, res: Response): EmailRequestContext {
  const cookies = parseCookieHeader(req.headers.cookie);
  const cookieGuard = cleanGuardId(cookies.get(EMAIL_GUARD_COOKIE));
  const headerGuard = cleanGuardId(headerValue(req.headers["x-nearloy-email-guard"]));
  const emailGuardId = cookieGuard ?? headerGuard ?? randomBytes(18).toString("base64url");
  const forwardedProto = headerValue(req.headers["x-forwarded-proto"]);
  const secure =
    process.env.NODE_ENV === "production" ||
    Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_SERVICE_ID) ||
    forwardedProto === "https";

  res.cookie(EMAIL_GUARD_COOKIE, emailGuardId, {
    httpOnly: true,
    maxAge: EMAIL_GUARD_MAX_AGE_MS,
    path: "/",
    sameSite: secure ? "none" : "lax",
    secure,
  });

  return {
    ...loginContextFromRequest(req),
    emailGuardId,
  };
}

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  @ApiBody({ type: RegisterDto })
  @ApiOperation({
    summary: "Register",
    description:
      "Creates a user with password hash (bcrypt). Default role is CLIENT. COMPANY allowed; ADMIN is rejected (provision separately).",
  })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post("register/request-code")
  @ApiBody({ type: RequestRegistrationCodeDto })
  @ApiOperation({
    summary: "Request email code before registration",
    description:
      "Stores a pending registration request and sends a six-digit code to the email. The user is created only after code verification.",
  })
  requestRegistrationCode(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: RequestRegistrationCodeDto,
  ) {
    return this.auth.requestRegistrationCode(dto, emailRequestContextFromRequest(req, res));
  }

  @Post("register/verify")
  @ApiBody({ type: VerifyRegistrationCodeDto })
  @ApiOperation({
    summary: "Verify registration code and create user",
    description: "Creates a verified user account and issues regular access + refresh tokens.",
  })
  verifyRegistrationCode(@Body() dto: VerifyRegistrationCodeDto) {
    return this.auth.verifyRegistrationCode(dto);
  }

  @Post("password-reset/request-code")
  @ApiBody({ type: RequestPasswordResetDto })
  @ApiOperation({
    summary: "Request password reset code",
    description:
      "Sends a six-digit password reset code when the account exists. Response is generic to avoid email enumeration.",
  })
  requestPasswordResetCode(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: RequestPasswordResetDto,
  ) {
    return this.auth.requestPasswordResetCode(dto, emailRequestContextFromRequest(req, res));
  }

  @Post("password-reset/confirm")
  @ApiBody({ type: ConfirmPasswordResetDto })
  @ApiOperation({ summary: "Confirm password reset code and set a new password" })
  confirmPasswordReset(@Body() dto: ConfirmPasswordResetDto) {
    return this.auth.confirmPasswordReset(dto);
  }

  @Post("login")
  @ApiBody({ type: LoginDto })
  @UseGuards(AuthGuard("local"))
  @ApiOperation({ summary: "Login (local email/password)" })
  async login(@Req() req: Request & { user: User }) {
    const ctx = loginContextFromRequest(req);
    await this.auth.recordLoginEvent(req.user.id, ctx);
    return this.auth.issueTokens(req.user);
  }

  @Post("telegram-mini-app")
  @ApiBody({ type: TelegramMiniAppLoginDto })
  @ApiOperation({
    summary: "Login from linked client session",
    description:
      "Validates a linked client-session payload and issues regular access + refresh tokens.",
  })
  telegramMiniAppLogin(@Req() req: Request, @Body() dto: TelegramMiniAppLoginDto) {
    return this.auth.loginWithTelegramMiniApp(dto.initData, loginContextFromRequest(req));
  }

  @Post("telegram-mini-app/link")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("access-token")
  @ApiBody({ type: TelegramMiniAppLoginDto })
  @ApiOperation({ summary: "Link current account to Telegram mini-app identity" })
  linkTelegramMiniApp(@CurrentUser() user: RequestUser, @Body() dto: TelegramMiniAppLoginDto) {
    return this.auth.linkTelegramMiniApp(user.userId, dto.initData);
  }

  @Post("max-mini-app")
  @ApiBody({ type: MaxMiniAppLoginDto })
  @ApiOperation({
    summary: "Login from linked MAX mini-app session",
    description:
      "Validates a MAX mini-app payload and issues regular access + refresh tokens.",
  })
  maxMiniAppLogin(@Req() req: Request, @Body() dto: MaxMiniAppLoginDto) {
    return this.auth.loginWithMaxMiniApp(dto.initData, loginContextFromRequest(req));
  }

  @Post("max-mini-app/link")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("access-token")
  @ApiBody({ type: MaxMiniAppLoginDto })
  @ApiOperation({ summary: "Link current account to MAX mini-app identity" })
  linkMaxMiniApp(@CurrentUser() user: RequestUser, @Body() dto: MaxMiniAppLoginDto) {
    return this.auth.linkMaxMiniApp(user.userId, dto.initData);
  }

  @Post("refresh")
  @ApiBody({ type: RefreshDto })
  @ApiOperation({ summary: "Rotate refresh token and get new access + refresh tokens" })
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Current user profile" })
  me(@CurrentUser() user: RequestUser) {
    return this.auth.findSafeUserById(user.userId);
  }

  @Post("change-password")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("access-token")
  @ApiBody({ type: ChangePasswordDto })
  @ApiOperation({ summary: "Change password (keeps current session)" })
  changePassword(@CurrentUser() user: RequestUser, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user.userId, dto.currentPassword, dto.newPassword);
  }

  @Post("account/freeze")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Schedule account deletion",
    description:
      "Marks account as frozen; user has 5 days to reactivate via login. Refresh tokens are revoked.",
  })
  freezeAccount(@CurrentUser() user: RequestUser) {
    return this.auth.freezeAccount(user.userId);
  }

  @Post("account/reactivate")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Cancel scheduled deletion and issue new tokens" })
  reactivate(@CurrentUser() user: RequestUser) {
    return this.auth.reactivateAccount(user.userId);
  }

  @Post("email-change/confirm")
  @ApiBody({ type: ConfirmEmailChangeDto })
  @ApiOperation({ summary: "Confirm email change via secure token from email link" })
  confirmEmailChange(@Body() dto: ConfirmEmailChangeDto) {
    return this.auth.confirmEmailChange(dto.token);
  }
}
