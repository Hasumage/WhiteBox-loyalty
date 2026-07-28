import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RegisteredService } from "./registered.service";

@ApiTags("public")
@Controller("public")
export class PublicRegisteredController {
  constructor(private readonly registeredService: RegisteredService) {}

  @Get("companies")
  @ApiOperation({ summary: "Public company suggestions" })
  companies(@Query("exclude") exclude?: string, @Query("limit") limit?: string) {
    return this.registeredService.publicCompanySuggestions(exclude, limit);
  }

  @Get("companies/:slug")
  @ApiOperation({ summary: "Public company loyalty card preview by slug" })
  company(@Param("slug") slug: string) {
    return this.registeredService.publicCompany(slug);
  }
}
