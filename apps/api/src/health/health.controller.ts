import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { AllowDuringMaintenance } from "../maintenance/allow-during-maintenance.decorator";

@ApiTags("health")
@Controller("health")
export class HealthController {
  @Get()
  @AllowDuringMaintenance()
  @ApiOperation({ summary: "Health check" })
  ok() {
    return { status: "ok", service: "nearloy-api" };
  }
}
