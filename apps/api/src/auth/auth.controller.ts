import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { User } from "@prisma/client";
import type { Request } from "express";
import { AuthService, type LoginContext } from "./auth.service";
import { CurrentUser, type RequestUser } from "./decorators/current-user.decorator";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { ConfirmEmailChangeDto } from "./dto/confirm-email-change.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { RegisterDto } from "./dto/register.dto";
import { RequestRegistrationCodeDto } from "./dto/request-registration-code.dto";
import { TelegramMiniAppLoginDto } from "./dto/telegram-mini-app-login.dto";
import { VerifyRegistrationCodeDto } from "./dto/verify-registration-code.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";

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

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  @ApiBody({ type: RegisterDto })
  @ApiOperation({
    summary: "Register",
    description:
      "Creates a user with password hash (bcrypt). Default role is CLIENT (TWA). COMPANY allowed; ADMIN is rejected (provision separately).",
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
  requestRegistrationCode(@Body() dto: RequestRegistrationCodeDto) {
    return this.auth.requestRegistrationCode(dto);
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
    summary: "Login from Telegram Mini App",
    description:
      "Validates Telegram Mini App initData with the bot token, finds a linked NearLoy account by telegramId, and issues the regular access + refresh tokens.",
  })
  telegramMiniAppLogin(@Req() req: Request, @Body() dto: TelegramMiniAppLoginDto) {
    return this.auth.loginWithTelegramMiniApp(dto.initData, loginContextFromRequest(req));
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
