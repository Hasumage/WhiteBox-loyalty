import { Body, Controller, Get, Param, Patch, Post, Query, Res, StreamableFile, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import type { Response } from "express";
import { CurrentUser, type RequestUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CreateHuntPlaceDto } from "./dto/create-hunt-place.dto";
import { CreateHuntPostDto } from "./dto/create-hunt-post.dto";
import { CreateHuntBattleDto } from "./dto/create-hunt-battle.dto";
import { GeocodeHuntAddressDto } from "./dto/geocode-hunt-address.dto";
import { ModerateHuntPostDto } from "./dto/moderate-hunt-post.dto";
import { OpenHuntBoxDto } from "./dto/open-hunt-box.dto";
import { ReportHuntPostDto } from "./dto/report-hunt-post.dto";
import { UploadHuntMediaDto } from "./dto/upload-hunt-media.dto";
import { ApplyHuntCardUpgradeBonusDto, UpgradeHuntCardDto } from "./dto/upgrade-hunt-card.dto";
import { HuntService } from "./hunt.service";

@ApiTags("hunt")
@ApiBearerAuth("access-token")
@Controller("hunt")
export class HuntController {
  constructor(private readonly huntService: HuntService) {}

  @Get("overview")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: "Nearloy Hunt player overview, missions, boxes and recent cards" })
  overview(@CurrentUser() user: RequestUser) {
    return this.huntService.overview(user.userId);
  }

  @Post("tutorial/complete")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: "Mark Nearloy Hunt tutorial as completed" })
  completeTutorial(@CurrentUser() user: RequestUser) {
    return this.huntService.completeTutorial(user.userId);
  }

  @Get("feed")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: "Nearloy Hunt published post feed" })
  feed(@CurrentUser() user: RequestUser) {
    return this.huntService.feed(user.userId);
  }

  @Get("public/feed")
  @ApiOperation({ summary: "Public read-only Nearloy Hunt published post feed" })
  publicFeed() {
    return this.huntService.publicFeed();
  }

  @Get("places")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: "Search or list Hunt places" })
  places(@Query("q") query?: string) {
    return this.huntService.places(query);
  }

  @Post("places")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER)
  @ApiBody({ type: CreateHuntPlaceDto })
  @ApiOperation({ summary: "Create or upsert a user-suggested Hunt place" })
  createPlace(@CurrentUser() user: RequestUser, @Body() dto: CreateHuntPlaceDto) {
    return this.huntService.createPlace(user.userId, dto);
  }

  @Post("geocode")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER)
  @ApiBody({ type: GeocodeHuntAddressDto })
  @ApiOperation({ summary: "Validate and normalize a Hunt address with Yandex Geocoder" })
  geocodeAddress(@Body() dto: GeocodeHuntAddressDto) {
    return this.huntService.geocodeAddress(dto.address);
  }

  @Post("media")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER)
  @ApiBody({ type: UploadHuntMediaDto })
  @ApiOperation({ summary: "Upload Hunt post media to server-side storage" })
  uploadMedia(@CurrentUser() user: RequestUser, @Body() dto: UploadHuntMediaDto) {
    return this.huntService.uploadMedia(user.userId, dto);
  }

  @Get("media/:fileName")
  @ApiOperation({ summary: "Read uploaded Hunt media" })
  async readMedia(@Param("fileName") fileName: string, @Res({ passthrough: true }) res: Response) {
    const media = await this.huntService.readMedia(fileName);
    res.setHeader("Content-Type", media.contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return new StreamableFile(media.buffer);
  }

  @Get("share/posts/:uuid")
  @ApiOperation({ summary: "Public read-only Hunt post share payload" })
  sharePost(@Param("uuid") uuid: string) {
    return this.huntService.sharePost(uuid);
  }

  @Get("share/cards/:uuid")
  @ApiOperation({ summary: "Public read-only Hunt card share payload" })
  shareCard(@Param("uuid") uuid: string) {
    return this.huntService.shareCard(uuid);
  }

  @Get("cards/catalog")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: "Nearloy Hunt creature species catalog with owned duplicate counts" })
  cardCatalog(@CurrentUser() user: RequestUser) {
    return this.huntService.cardCatalog(user.userId);
  }

  @Post("posts")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER)
  @ApiBody({ type: CreateHuntPostDto })
  @ApiOperation({ summary: "Create a GPS/place-bound Hunt post and grant server-side rewards" })
  createPost(@CurrentUser() user: RequestUser, @Body() dto: CreateHuntPostDto) {
    return this.huntService.createPost(user.userId, dto);
  }

  @Post("posts/:uuid/like")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: "Like a Hunt post and grant weighted NearCoin to the author" })
  likePost(@CurrentUser() user: RequestUser, @Param("uuid") uuid: string) {
    return this.huntService.likePost(user.userId, uuid);
  }

  @Post("posts/:uuid/report")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER)
  @ApiBody({ type: ReportHuntPostDto })
  @ApiOperation({ summary: "Report a Hunt post for moderation" })
  reportPost(@CurrentUser() user: RequestUser, @Param("uuid") uuid: string, @Body() dto: ReportHuntPostDto) {
    return this.huntService.reportPost(user.userId, uuid, dto);
  }

  @Post("boxes/open")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER)
  @ApiBody({ type: OpenHuntBoxDto })
  @ApiOperation({ summary: "Open a granted box or buy a standard one with server-side currency" })
  openBox(@CurrentUser() user: RequestUser, @Body() dto: OpenHuntBoxDto) {
    return this.huntService.openBox(user.userId, dto.boxUuid, dto.boxType);
  }

  @Post("cards/upgrade")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER)
  @ApiBody({ type: UpgradeHuntCardDto })
  @ApiOperation({ summary: "Upgrade an owned Hunt card with server-side NearCoin" })
  upgradeCard(@CurrentUser() user: RequestUser, @Body() dto: UpgradeHuntCardDto) {
    return this.huntService.upgradeCard(user.userId, dto.cardUuid, dto.focusStat);
  }

  @Post("cards/upgrade/bonus")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER)
  @ApiBody({ type: ApplyHuntCardUpgradeBonusDto })
  @ApiOperation({ summary: "Apply one irreversible bonus stat after a Hunt card upgrade" })
  applyUpgradeBonus(@CurrentUser() user: RequestUser, @Body() dto: ApplyHuntCardUpgradeBonusDto) {
    return this.huntService.applyUpgradeBonus(user.userId, dto.upgradeUuid, dto.focusStat);
  }

  @Post("battle/random")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER)
  @ApiBody({ type: CreateHuntBattleDto })
  @ApiOperation({ summary: "Find a server-side random Nearloy Hunt battle opponent" })
  randomBattle(@CurrentUser() user: RequestUser, @Body() dto: CreateHuntBattleDto) {
    return this.huntService.randomBattle(user.userId, dto.cardUuid);
  }

  @Post("battle/code")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER)
  @ApiBody({ type: CreateHuntBattleDto })
  @ApiOperation({ summary: "Create a short Nearloy Hunt private match code" })
  createBattleCode(@CurrentUser() user: RequestUser, @Body() dto: CreateHuntBattleDto) {
    return this.huntService.createBattleCode(user.userId, dto.cardUuid);
  }

  @Get("growth/places")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: "Admin growth report for places with organic Hunt demand" })
  growthPlaces() {
    return this.huntService.growthPlaces();
  }

  @Get("moderation/posts")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: "Admin moderation queue for flagged Hunt posts" })
  moderationQueue() {
    return this.huntService.moderationQueue();
  }

  @Patch("moderation/posts/:uuid")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER)
  @ApiBody({ type: ModerateHuntPostDto })
  @ApiOperation({ summary: "Admin moderation action for a Hunt post" })
  moderatePost(@CurrentUser() user: RequestUser, @Param("uuid") uuid: string, @Body() dto: ModerateHuntPostDto) {
    return this.huntService.moderatePost(user.userId, uuid, dto);
  }
}
