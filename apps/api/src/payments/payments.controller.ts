import { Body, Controller, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { PaymentsService } from "./payments.service";

@ApiTags("payments")
@Controller("payments")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post("yookassa/webhook")
  @ApiOperation({ summary: "YooKassa webhook endpoint. Public by design; payment is verified by provider status sync." })
  yookassaWebhook(@Body() body: unknown) {
    return this.paymentsService.handleYooKassaWebhook(body);
  }
}
