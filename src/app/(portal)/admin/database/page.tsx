"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeDollarSign,
  Bell,
  Building2,
  CheckSquare,
  ChevronDown,
  ClipboardList,
  Database,
  Eye,
  EyeOff,
  FileCheck,
  Gift,
  GitMerge,
  KeyRound,
  LayoutGrid,
  Link2,
  MailCheck,
  MapPin,
  Megaphone,
  Minus,
  Plus,
  Receipt,
  RotateCcw,
  Shield,
  Sparkles,
  Tags,
  Ticket,
  User as UserIcon,
  UsersRound,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/use-i18n";
import { cn } from "@/lib/utils";

type GroupId = "core" | "company" | "subscriptions" | "links" | "growth" | "security" | "operations";
type Icon = React.ComponentType<{ className?: string }>;

type ModelDefinition = {
  id: string;
  subtitle: string;
  fields: string[];
  group: GroupId;
  icon: Icon;
  color: string;
};

type Node = ModelDefinition & { x: number; y: number };
type Edge = { from: string; to: string; label: string };
type PresetId = "all" | "company-flow" | "security" | "loyalty" | "growth" | "operations" | "map";
type SchemaPreset = { id: PresetId; icon: Icon; visibleGroups: GroupId[] };

const NODE_W = 250;
const HEADER_H = 38;
const ROW_H = 22;
const PADDING = 8;
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 2.5;

const COLORS: Record<GroupId, string> = {
  core: "rgba(34,211,238,0.24)",
  company: "rgba(45,212,191,0.24)",
  subscriptions: "rgba(99,102,241,0.24)",
  links: "rgba(217,70,239,0.22)",
  growth: "rgba(250,204,21,0.22)",
  security: "rgba(251,113,133,0.22)",
  operations: "rgba(148,163,184,0.24)",
};

const define = (
  id: string,
  group: GroupId,
  subtitle: string,
  fields: string[],
  icon: Icon,
): ModelDefinition => ({ id, group, subtitle, fields, icon, color: COLORS[group] });

// Keep this list aligned with prisma/schema.prisma. Fields are intentionally concise
// so the full production schema remains readable on one interactive canvas.
const modelDefinitions: ModelDefinition[] = [
  define("User", "core", "identity", ["id", "uuid", "email", "role", "accountStatus"], UserIcon),
  define("ProfileStatus", "core", "profile status catalog", ["id", "slug", "name", "rarity"], Sparkles),
  define("UserProfileStatusUnlock", "core", "status unlock ledger", ["id", "userId", "profileStatusId", "seenAt?"], Gift),
  define("PlatformCounter", "core", "platform counters", ["id", "key", "value", "updatedAt"], Database),
  define("AdminUserPermission", "core", "access control", ["id", "userId", "permissionKey", "canView", "canEdit"], Shield),
  define("Category", "core", "category dictionary", ["id", "slug", "name", "icon"], Tags),

  define("Company", "company", "partner profile", ["id", "uuid", "slug", "ownerUserId?", "verificationStatus"], Building2),
  define("CompanyBillingAccount", "company", "monthly billing", ["id", "companyId", "status", "trialEndsAt?", "paidThrough?"], Wallet),
  define("CompanyBillingInvoice", "company", "billing invoice", ["id", "companyId", "amount", "status", "dueAt"], Receipt),
  define("CompanyBillingPromoCode", "company", "billing discount", ["id", "code", "discountPercent", "createdByUserId"], Ticket),
  define("CompanyBillingPromoRedemption", "company", "billing promo ledger", ["id", "promoCodeId", "companyId", "redeemedAt"], Ticket),
  define("CompanyReferral", "company", "company acquisition", ["id", "companyId", "referrerUserId?", "supportManagerUserId?", "stage"], Megaphone),
  define("CompanyVerificationApplication", "company", "verification request", ["id", "companyId", "status", "employmentType", "submittedAt"], FileCheck),
  define("PassportVerificationFile", "company", "encrypted document", ["id", "applicationId", "storageKey", "encryptedAt"], Shield),
  define("CompanyLocation", "company", "branches and map", ["id", "companyId", "address", "latitude", "longitude"], MapPin),
  define("CompanyCategory", "company", "company categories", ["id", "companyId", "categoryId"], GitMerge),
  define("CompanyLevelRule", "company", "loyalty levels", ["id", "companyId", "levelName", "minTotalSpend", "cashbackPercent"], Sparkles),
  define("CompanyMember", "company", "company team", ["id", "companyId", "userId", "role", "permissions"], UsersRound),

  define("Subscription", "subscriptions", "subscription catalog", ["id", "uuid", "companyId", "price", "periodUnit"], BadgeDollarSign),
  define("SubscriptionBundle", "subscriptions", "paired subscription", ["id", "uuid", "name", "status", "price"], Link2),
  define("SubscriptionBundleParticipant", "subscriptions", "bundle partners", ["id", "bundleId", "companyId", "revenuePercent"], GitMerge),
  define("UserSubscriptionBundle", "subscriptions", "customer bundle", ["id", "userId", "bundleId", "status", "expiresAt"], Ticket),
  define("CompanyPurchase", "subscriptions", "company revenue", ["id", "companyId", "userId", "subscriptionId?", "grossAmount"], Receipt),
  define("UserSubscription", "subscriptions", "customer subscription", ["id", "userId", "subscriptionId", "status", "expiresAt"], Ticket),
  define("SubscriptionEntitlement", "subscriptions", "service and limit", ["id", "subscriptionId", "title", "limitPeriod", "limitCount"], Gift),
  define("SubscriptionRedemption", "subscriptions", "service redemption", ["id", "userSubscriptionId", "entitlementId", "companyId", "redeemedAt"], CheckSquare),
  define("SubscriptionBundleRedemption", "subscriptions", "bundle redemption", ["id", "userBundleId", "participantId", "redeemedAt"], CheckSquare),

  define("UserFavoriteCategory", "links", "favorite categories", ["id", "userId", "categoryId"], GitMerge),
  define("UserCompany", "links", "company customer", ["id", "userId", "companyId", "balance", "totalSpend"], GitMerge),
  define("UserProfilePreference", "links", "profile preferences", ["id", "userId", "locale", "profileVisibility", "marketingOptIn"], Sparkles),

  define("PromoCode", "growth", "customer promo", ["id", "code", "rewardType", "companyId?", "subscriptionId?"], Ticket),
  define("PromoCodeRedemption", "growth", "promo redemption", ["id", "promoCodeId", "userId", "redeemedAt"], Ticket),
  define("ReferralCampaign", "growth", "referral rules", ["id", "title", "inviterBonusPoints", "invitedBonusPoints"], Megaphone),
  define("ReferralInvite", "growth", "referral ledger", ["id", "code", "inviterUserId", "invitedUserId?", "status"], UsersRound),
  define("LandingLead", "growth", "landing lead", ["id", "uuid", "contact", "status", "createdAt"], Megaphone),

  define("RefreshToken", "security", "session", ["id", "userId", "tokenHash", "expiresAt", "revokedAt?"], KeyRound),
  define("OAuthAccount", "security", "federated identity", ["id", "userId", "provider", "providerAccountId"], KeyRound),
  define("LoginEvent", "security", "login metadata", ["id", "userId", "deviceKey", "ipAddress?", "createdAt"], Shield),
  define("EmailChangeRequest", "security", "protected email change", ["id", "userId", "requestedByUserId", "expiresAt"], MailCheck),
  define("TelegramLinkToken", "security", "Telegram binding", ["id", "userId", "tokenHash", "expiresAt", "usedAt?"], Link2),
  define("CustomerLookupCode", "security", "cashier lookup", ["id", "userId", "codeHash", "expiresAt", "usedAt?"], KeyRound),

  define("FinanceOperation", "operations", "finance request", ["id", "companyId?", "type", "amount", "status"], Wallet),
  define("LoyaltyTransaction", "operations", "points ledger", ["id", "userId", "companyId", "type", "amount"], Wallet),
  define("AuditEvent", "operations", "audit stream", ["id", "workspace", "category", "actorUserId?", "result"], ClipboardList),
  define("AdminTask", "operations", "admin task queue", ["id", "type", "status", "assigneeUserId?", "auditEventId?"], CheckSquare),
  define("NotificationDelivery", "operations", "notification history", ["id", "channel", "recipient", "status", "sentAt?"], Bell),
  define("TelegramMessageQueue", "operations", "Telegram queue", ["id", "chatId", "status", "attempts", "nextAttemptAt?"], Bell),
];

const nodes: Node[] = modelDefinitions.map((model, index) => ({
  ...model,
  x: 70 + (index % 6) * 310,
  y: 70 + Math.floor(index / 6) * 230,
}));

const edges: Edge[] = [
  { from: "User", to: "AdminUserPermission", label: "1:N" },
  { from: "User", to: "UserProfileStatusUnlock", label: "1:N" },
  { from: "ProfileStatus", to: "UserProfileStatusUnlock", label: "1:N" },
  { from: "User", to: "Company", label: "1:N owner" },
  { from: "Company", to: "CompanyBillingAccount", label: "1:1" },
  { from: "Company", to: "CompanyBillingInvoice", label: "1:N" },
  { from: "CompanyBillingPromoCode", to: "CompanyBillingPromoRedemption", label: "1:N" },
  { from: "Company", to: "CompanyBillingPromoRedemption", label: "1:N" },
  { from: "Company", to: "CompanyReferral", label: "1:1" },
  { from: "Company", to: "CompanyVerificationApplication", label: "1:N" },
  { from: "CompanyVerificationApplication", to: "PassportVerificationFile", label: "1:N" },
  { from: "Company", to: "CompanyLocation", label: "1:N" },
  { from: "Company", to: "CompanyCategory", label: "1:N" },
  { from: "Category", to: "CompanyCategory", label: "1:N" },
  { from: "Company", to: "CompanyLevelRule", label: "1:N" },
  { from: "Company", to: "CompanyMember", label: "1:N" },
  { from: "User", to: "CompanyMember", label: "1:N" },
  { from: "Company", to: "Subscription", label: "1:N" },
  { from: "SubscriptionBundle", to: "SubscriptionBundleParticipant", label: "1:N" },
  { from: "Company", to: "SubscriptionBundleParticipant", label: "1:N" },
  { from: "User", to: "UserSubscriptionBundle", label: "1:N" },
  { from: "SubscriptionBundle", to: "UserSubscriptionBundle", label: "1:N" },
  { from: "Company", to: "CompanyPurchase", label: "1:N" },
  { from: "User", to: "CompanyPurchase", label: "1:N" },
  { from: "User", to: "UserSubscription", label: "1:N" },
  { from: "Subscription", to: "UserSubscription", label: "1:N" },
  { from: "Subscription", to: "SubscriptionEntitlement", label: "1:N" },
  { from: "UserSubscription", to: "SubscriptionRedemption", label: "1:N" },
  { from: "SubscriptionEntitlement", to: "SubscriptionRedemption", label: "1:N" },
  { from: "UserSubscriptionBundle", to: "SubscriptionBundleRedemption", label: "1:N" },
  { from: "User", to: "UserFavoriteCategory", label: "1:N" },
  { from: "Category", to: "UserFavoriteCategory", label: "1:N" },
  { from: "User", to: "UserCompany", label: "1:N" },
  { from: "Company", to: "UserCompany", label: "1:N" },
  { from: "User", to: "UserProfilePreference", label: "1:1" },
  { from: "PromoCode", to: "PromoCodeRedemption", label: "1:N" },
  { from: "User", to: "PromoCodeRedemption", label: "1:N" },
  { from: "ReferralCampaign", to: "ReferralInvite", label: "1:N" },
  { from: "User", to: "ReferralInvite", label: "1:N" },
  { from: "User", to: "RefreshToken", label: "1:N" },
  { from: "User", to: "OAuthAccount", label: "1:N" },
  { from: "User", to: "LoginEvent", label: "1:N" },
  { from: "User", to: "EmailChangeRequest", label: "1:N" },
  { from: "User", to: "TelegramLinkToken", label: "1:N" },
  { from: "User", to: "CustomerLookupCode", label: "1:N" },
  { from: "Company", to: "FinanceOperation", label: "1:N" },
  { from: "User", to: "LoyaltyTransaction", label: "1:N" },
  { from: "Company", to: "LoyaltyTransaction", label: "1:N" },
  { from: "User", to: "AuditEvent", label: "1:N actor" },
  { from: "AuditEvent", to: "AdminTask", label: "1:N" },
];

const presets: SchemaPreset[] = [
  { id: "all", icon: LayoutGrid, visibleGroups: ["core", "company", "subscriptions", "links", "growth", "security", "operations"] },
  { id: "company-flow", icon: Building2, visibleGroups: ["company", "subscriptions", "links"] },
  { id: "security", icon: Shield, visibleGroups: ["core", "security", "operations"] },
  { id: "loyalty", icon: Sparkles, visibleGroups: ["core", "subscriptions", "links", "operations"] },
  { id: "growth", icon: Megaphone, visibleGroups: ["company", "growth"] },
  { id: "operations", icon: Wallet, visibleGroups: ["company", "operations"] },
  { id: "map", icon: MapPin, visibleGroups: ["core", "company", "links"] },
];

const nodeGroups: { id: GroupId; icon: Icon }[] = [
  { id: "core", icon: LayoutGrid },
  { id: "company", icon: Building2 },
  { id: "subscriptions", icon: Ticket },
  { id: "links", icon: Link2 },
  { id: "growth", icon: Megaphone },
  { id: "security", icon: Shield },
  { id: "operations", icon: Wallet },
];

function nodeHeight(node: Node) {
  return HEADER_H + node.fields.length * ROW_H + PADDING * 2;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export default function AdminDatabasePage() {
  const { t } = useI18n();
  const [zoom, setZoom] = useState(0.62);
  const [offset, setOffset] = useState({ x: 24, y: 16 });
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [hiddenNodes, setHiddenNodes] = useState<Set<string>>(new Set());
  const [presetOpen, setPresetOpen] = useState(false);
  const [activePresetId, setActivePresetId] = useState<PresetId | "custom">("all");
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const zoomRef = useRef(zoom);
  const offsetRef = useRef(offset);

  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), []);
  const visibleNodes = useMemo(() => nodes.filter((node) => !hiddenNodes.has(node.id)), [hiddenNodes]);
  const visibleEdges = useMemo(
    () => edges.filter((edge) => !hiddenNodes.has(edge.from) && !hiddenNodes.has(edge.to)),
    [hiddenNodes],
  );

  const presetText: Record<PresetId, { label: string; description: string }> = {
    all: { label: t("admin.database.fullSchema"), description: t("admin.database.fullSchemaDescription") },
    "company-flow": { label: t("admin.database.companyFlow"), description: t("admin.database.companyFlowDescription") },
    security: { label: t("admin.database.securityAccess"), description: t("admin.database.securityAccessDescription") },
    loyalty: { label: t("admin.database.loyalty"), description: t("admin.database.loyaltyDescription") },
    growth: { label: t("admin.database.growth"), description: t("admin.database.growthDescription") },
    operations: { label: t("admin.database.operations"), description: t("admin.database.operationsDescription") },
    map: { label: t("admin.database.mapBranches"), description: t("admin.database.mapBranchesDescription") },
  };
  const groupLabels: Record<GroupId, string> = {
    core: t("admin.database.groupCore"),
    company: t("admin.database.groupCompany"),
    subscriptions: t("admin.database.groupSubscriptions"),
    links: t("admin.database.groupLinks"),
    growth: t("admin.database.groupGrowth"),
    security: t("admin.database.groupSecurity"),
    operations: t("admin.database.groupOperations"),
  };

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  function setZoomAt(nextZoom: number, clientX?: number, clientY?: number) {
    const clampedZoom = clamp(Number(nextZoom.toFixed(3)), MIN_ZOOM, MAX_ZOOM);
    if (!viewportRef.current || clientX === undefined || clientY === undefined) {
      setZoom(clampedZoom);
      return;
    }
    const rect = viewportRef.current.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const worldX = (localX - offsetRef.current.x) / zoomRef.current;
    const worldY = (localY - offsetRef.current.y) / zoomRef.current;
    setOffset({ x: Math.round(localX - worldX * clampedZoom), y: Math.round(localY - worldY * clampedZoom) });
    setZoom(clampedZoom);
  }

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    function handleWheel(event: WheelEvent) {
      event.preventDefault();
      event.stopPropagation();
      setZoomAt(zoomRef.current + (event.deltaY < 0 ? 0.09 : -0.09), event.clientX, event.clientY);
    }
    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", handleWheel);
  }, []);

  function resetView() {
    setZoom(0.62);
    setOffset({ x: 24, y: 16 });
    setFocusedNodeId(null);
  }

  function focusNode(nodeId: string) {
    const node = byId.get(nodeId);
    const viewport = viewportRef.current;
    if (!node || !viewport || hiddenNodes.has(nodeId)) return;
    const rect = viewport.getBoundingClientRect();
    setOffset({
      x: Math.round(rect.width / 2 - (node.x + NODE_W / 2) * zoom),
      y: Math.round(rect.height / 2 - (node.y + nodeHeight(node) / 2) * zoom),
    });
    setFocusedNodeId(node.id);
  }

  function toggleNodeVisibility(nodeId: string) {
    setHiddenNodes((previous) => {
      const next = new Set(previous);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
    if (focusedNodeId === nodeId) setFocusedNodeId(null);
    setActivePresetId("custom");
  }

  function applyPreset(preset: SchemaPreset) {
    const visibleGroups = new Set(preset.visibleGroups);
    setHiddenNodes(new Set(nodes.filter((node) => !visibleGroups.has(node.group)).map((node) => node.id)));
    setActivePresetId(preset.id);
    setPresetOpen(false);
    setFocusedNodeId(null);
  }

  const activePresetLabel = activePresetId === "custom" ? t("admin.database.custom") : presetText[activePresetId].label;
  const hint = t("admin.database.hint")
    .replace("{visible}", String(visibleNodes.length))
    .replace("{total}", String(nodes.length))
    .replace("{zoom}", (zoom * 100).toFixed(0));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("admin.database.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("admin.database.description")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setZoomAt(zoom - 0.1)}><Minus className="h-4 w-4" />{t("admin.database.zoomOut")}</Button>
          <Button variant="secondary" size="sm" onClick={() => setZoomAt(zoom + 0.1)}><Plus className="h-4 w-4" />{t("admin.database.zoomIn")}</Button>
          <Button variant="outline" size="sm" onClick={resetView}><RotateCcw className="h-4 w-4" />{t("admin.database.reset")}</Button>
        </div>
      </div>

      <Card className="glass border-white/10">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">{t("admin.database.visualizer")}</CardTitle>
            <div className="relative">
              <Button type="button" variant="secondary" size="sm" onClick={() => setPresetOpen((value) => !value)} className="gap-2">
                <LayoutGrid className="h-4 w-4" />
                {t("admin.database.viewPreset")}: {activePresetLabel}
                <ChevronDown className={cn("h-4 w-4 transition-transform", presetOpen && "rotate-180")} />
              </Button>
              {presetOpen && (
                <div className="absolute right-0 top-10 z-20 w-80 rounded-xl border border-white/10 bg-slate-950/95 p-2 shadow-2xl backdrop-blur">
                  {presets.map((preset) => (
                    <button key={preset.id} type="button" onClick={() => applyPreset(preset)} className={cn("flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors", activePresetId === preset.id ? "bg-primary/20" : "hover:bg-white/5")}>
                      <span className="mt-0.5 rounded-md border border-white/10 bg-white/5 p-1.5"><preset.icon className="h-4 w-4" /></span>
                      <span><span className="block text-sm font-medium">{presetText[preset.id].label}</span><span className="block text-xs text-muted-foreground">{presetText[preset.id].description}</span></span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            {nodeGroups.map((group) => {
              const items = nodes.filter((node) => node.group === group.id);
              return (
                <div key={group.id} className="rounded-xl border border-white/10 bg-muted/10 p-2.5">
                  <div className="mb-2 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <group.icon className="h-3.5 w-3.5" />{groupLabels[group.id]}
                    <span className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px]">{items.length}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {items.map((node) => {
                      const hidden = hiddenNodes.has(node.id);
                      return (
                        <div key={node.id} className="inline-flex items-center rounded-md border border-white/10 bg-muted/20 pr-1">
                          <Button variant={focusedNodeId === node.id && !hidden ? "default" : "secondary"} size="sm" onClick={() => focusNode(node.id)} className="h-8 gap-1.5 rounded-r-none border-r border-white/10" disabled={hidden}>
                            <node.icon className="h-3.5 w-3.5" />{node.id}
                          </Button>
                          <button type="button" onClick={() => toggleNodeVisibility(node.id)} className="inline-flex h-8 w-8 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground" title={hidden ? t("admin.database.showTable") : t("admin.database.hideTable")}>
                            {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div
            ref={viewportRef}
            className={cn("relative h-[74vh] min-h-[560px] cursor-grab overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_2px_2px,rgba(255,255,255,0.09)_1px,transparent_0)] [background-size:24px_24px] overscroll-none touch-none select-none", dragStart && "cursor-grabbing")}
            onPointerDown={(event) => {
              if (event.pointerType === "mouse" && event.button !== 0) return;
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              setDragStart({ x: event.clientX - offsetRef.current.x, y: event.clientY - offsetRef.current.y });
            }}
            onPointerMove={(event) => {
              if (!dragStart) return;
              event.preventDefault();
              setOffset({ x: event.clientX - dragStart.x, y: event.clientY - dragStart.y });
            }}
            onPointerUp={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
              setDragStart(null);
            }}
            onPointerCancel={() => setDragStart(null)}
          >
            <svg className="absolute inset-0 h-full w-full">
              <g style={{ transition: dragStart ? "none" : "transform 260ms ease" }} transform={`translate(${offset.x},${offset.y}) scale(${zoom})`}>
                {visibleEdges.map((edge, index) => {
                  const from = byId.get(edge.from);
                  const to = byId.get(edge.to);
                  if (!from || !to) return null;
                  const x1 = from.x + NODE_W / 2;
                  const y1 = from.y + nodeHeight(from);
                  const x2 = to.x + NODE_W / 2;
                  const y2 = to.y;
                  const midX = (x1 + x2) / 2 + (index % 2 === 0 ? 10 : -10);
                  const midY = (y1 + y2) / 2;
                  return (
                    <g key={`${edge.from}-${edge.to}-${index}`}>
                      <path d={`M ${x1} ${y1} C ${x1} ${y1 + 80}, ${x2} ${y2 - 80}, ${x2} ${y2}`} fill="none" stroke="rgba(186,230,253,0.42)" strokeWidth="1.5" />
                      <rect x={midX - 30} y={midY - 10} width="60" height="20" rx="6" fill="rgba(15,23,42,0.88)" />
                      <text x={midX} y={midY + 4} textAnchor="middle" fontSize="10" fill="rgba(224,242,254,0.95)">{edge.label}</text>
                    </g>
                  );
                })}
                {visibleNodes.map((node) => (
                  <g key={node.id} transform={`translate(${node.x},${node.y})`}>
                    <rect width={NODE_W} height={nodeHeight(node)} rx="12" fill="rgba(2,6,23,0.9)" stroke={focusedNodeId === node.id ? "rgba(56,189,248,0.95)" : "rgba(255,255,255,0.14)"} strokeWidth={focusedNodeId === node.id ? "2" : "1"} />
                    <rect width={NODE_W} height={HEADER_H + 2} rx="12" fill={node.color} />
                    <text x="14" y="21" fill="white" fontSize="13" fontWeight="700">{node.id}</text>
                    <text x="14" y="34" fill="rgba(203,213,225,0.95)" fontSize="10">{node.subtitle}</text>
                    {node.fields.map((field, index) => (
                      <g key={field}>
                        <line x1={0} x2={NODE_W} y1={HEADER_H + PADDING + index * ROW_H} y2={HEADER_H + PADDING + index * ROW_H} stroke="rgba(255,255,255,0.07)" />
                        <text x="14" y={HEADER_H + PADDING + index * ROW_H + 15} fill="rgba(226,232,240,0.95)" fontSize="11">{field}</text>
                      </g>
                    ))}
                  </g>
                ))}
              </g>
            </svg>
            <div className="pointer-events-none absolute bottom-3 right-3 rounded-lg border border-white/10 bg-slate-950/75 px-3 py-1 text-xs text-muted-foreground">{hint}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
