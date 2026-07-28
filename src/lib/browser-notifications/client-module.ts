"use client";

import type { TwaCompany, TwaHistory } from "@/lib/api/twa-client";
import { geolocationPermissionAlreadyGranted } from "@/lib/capacitor/native-permissions";

const POINTS_SEEN_KEY = "nearloy:browser-notifications:seen-points";
const GEO_COOLDOWN_PREFIX = "nearloy:browser-notifications:geo:";
const GEO_RADIUS_METERS = 320;
const GEO_COOLDOWN_MS = 2 * 60 * 60 * 1000;
const GEO_ACTIVE_HOURS = { from: 9, to: 22 };
const MAX_SEEN_TRANSACTIONS = 160;

type ClientPosition = {
  latitude: number;
  longitude: number;
};

type BrowserNotifyOptions = {
  title: string;
  body: string;
  tag: string;
  url?: string;
};

export function browserNotificationsSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getBrowserNotificationPermission() {
  if (!browserNotificationsSupported()) return "unsupported" as const;
  return Notification.permission;
}

export async function requestBrowserNotificationPermission() {
  if (!browserNotificationsSupported()) return "unsupported" as const;
  if (Notification.permission !== "default") return Notification.permission;
  return Notification.requestPermission();
}

export async function geolocationAlreadyGranted() {
  return geolocationPermissionAlreadyGranted();
}

export function seedKnownPointTransactions(history: TwaHistory) {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(POINTS_SEEN_KEY)) return;
  storeSeenTransactionIds(history.transactions.map((transaction) => transaction.uuid));
}

export function notifyPointTransactions(history: TwaHistory) {
  if (getBrowserNotificationPermission() !== "granted") {
    seedKnownPointTransactions(history);
    return;
  }

  const seen = new Set(loadSeenTransactionIds());
  if (seen.size === 0) {
    seedKnownPointTransactions(history);
    return;
  }

  const fresh = history.transactions
    .filter((transaction) => transaction.status === "ACTIVE")
    .filter((transaction) => transaction.type === "EARN" || transaction.type === "SPEND")
    .filter((transaction) => !seen.has(transaction.uuid))
    .sort((left, right) => new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime());

  for (const transaction of fresh.slice(-4)) {
    const amount = Math.abs(transaction.amount);
    const isEarn = transaction.type === "EARN";
    showBrowserNotification({
      title: isEarn ? "Баллы начислены" : "Баллы списаны",
      body: isEarn
        ? `${transaction.company.name}: +${amount} баллов.`
        : `${transaction.company.name}: −${amount} баллов.`,
      tag: `points:${transaction.uuid}`,
      url: `/wallet/${transaction.company.slug}`,
    });
  }

  const ids = [...seen, ...history.transactions.map((transaction) => transaction.uuid)].slice(-MAX_SEEN_TRANSACTIONS);
  storeSeenTransactionIds(ids);
}

export function notifyNearbyCompanies(companies: TwaCompany[], position: ClientPosition) {
  if (getBrowserNotificationPermission() !== "granted") return;
  if (!isGeoNotificationTime()) return;

  const eligible = companies
    .filter((company) => company.isActive && company.locations.length > 0)
    .map((company) => {
      const nearest = company.locations
        .map((location) => ({
          location,
          distance: distanceMeters(position, {
            latitude: Number(location.latitude),
            longitude: Number(location.longitude),
          }),
        }))
        .sort((left, right) => left.distance - right.distance)[0];
      return { company, nearest };
    })
    .filter((row) => row.nearest && row.nearest.distance <= GEO_RADIUS_METERS)
    .sort((left, right) => left.nearest.distance - right.nearest.distance);

  for (const row of eligible.slice(0, 2)) {
    if (!canNotifyCompanyGeo(row.company.id)) continue;
    showBrowserNotification({
      title: `${row.company.name} рядом`,
      body: "Можно открыть карту лояльности и посмотреть бонусы.",
      tag: `geo:${row.company.id}`,
      url: `/wallet/${row.company.slug}`,
    });
    rememberCompanyGeoNotification(row.company.id);
  }
}

function showBrowserNotification(options: BrowserNotifyOptions) {
  if (getBrowserNotificationPermission() !== "granted") return;

  const notification = new Notification(options.title, {
    body: options.body,
    tag: options.tag,
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    silent: false,
  });

  notification.onclick = () => {
    window.focus();
    if (options.url) window.location.href = options.url;
    notification.close();
  };
}

function loadSeenTransactionIds() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(POINTS_SEEN_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function storeSeenTransactionIds(ids: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(POINTS_SEEN_KEY, JSON.stringify([...new Set(ids)].slice(-MAX_SEEN_TRANSACTIONS)));
}

function isGeoNotificationTime() {
  const hour = new Date().getHours();
  return hour >= GEO_ACTIVE_HOURS.from && hour < GEO_ACTIVE_HOURS.to;
}

function canNotifyCompanyGeo(companyId: number) {
  if (typeof window === "undefined") return false;
  const value = Number(window.localStorage.getItem(`${GEO_COOLDOWN_PREFIX}${companyId}`) ?? "0");
  return !Number.isFinite(value) || Date.now() - value >= GEO_COOLDOWN_MS;
}

function rememberCompanyGeoNotification(companyId: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`${GEO_COOLDOWN_PREFIX}${companyId}`, String(Date.now()));
}

function distanceMeters(left: ClientPosition, right: ClientPosition) {
  const earthRadiusMeters = 6371000;
  const leftLat = toRadians(left.latitude);
  const rightLat = toRadians(right.latitude);
  const deltaLat = toRadians(right.latitude - left.latitude);
  const deltaLon = toRadians(right.longitude - left.longitude);
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(leftLat) * Math.cos(rightLat) * Math.sin(deltaLon / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
