import { Module, forwardRef } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { RegisteredModule } from "../registered/registered.module";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { RegisteredPaymentsController } from "./registered-payments.controller";
import { YooKassaService } from "./yookassa.service";

@Module({
  imports: [PrismaModule, forwardRef(() => RegisteredModule)],
  controllers: [PaymentsController, RegisteredPaymentsController],
  providers: [PaymentsService, YooKassaService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
