import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { CurrentUser, type RequestUser } from "../auth/decorators/current-user.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { PaymentsService } from "./payments.service";

@ApiTags("registered-payments")
@ApiBearerAuth("access-token")
@Controller("registered/payments")
@UseGuards(RolesGuard)
@Roles(UserRole.CLIENT)
export class RegisteredPaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post("subscriptions/:uuid/checkout")
  @ApiOperation({ summary: "Create YooKassa checkout payment for a subscription plan" })
  createSubscriptionCheckout(@CurrentUser() user: RequestUser, @Param("uuid") uuid: string) {
    return this.paymentsService.createUserSubscriptionCheckout(user.userId, uuid);
  }

  @Get(":uuid")
  @ApiOperation({ summary: "Get current user's payment status" })
  getPayment(@CurrentUser() user: RequestUser, @Param("uuid") uuid: string) {
    return this.paymentsService.getUserPayment(user.userId, uuid);
  }
}
