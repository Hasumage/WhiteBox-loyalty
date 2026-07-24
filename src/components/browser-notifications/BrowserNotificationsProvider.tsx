"use client";

import { useEffect, useRef } from "react";
import { getAccessToken } from "@/lib/api/auth-client";
import { getTwaHistory, getTwaProfile, getTwaWallet, getUserTelegramStatus } from "@/lib/api/twa-client";
import {
  geolocationAlreadyGranted,
  getBrowserNotificationPermission,
  notifyNearbyCompanies,
  notifyPointTransactions,
  seedKnownPointTransactions,
} from "@/lib/browser-notifications/client-module";

const POINTS_SYNC_MS = 60 * 1000;
const GEO_SYNC_MS = 5 * 60 * 1000;

export function BrowserNotificationsProvider() {
  const lastGeoSyncAt = useRef(0);

  useEffect(() => {
    let disposed = false;

    async function sync() {
      if (disposed || !getAccessToken()) return;

      const [profile, telegram] = await Promise.all([getTwaProfile(), getUserTelegramStatus()]);
      if (disposed) return;

      const preferences = profile.preferences;
      const telegramConnected = telegram.ok && telegram.data.connected;

      if (preferences.browserNotificationsEnabled && !telegramConnected) {
        const history = await getTwaHistory(true);
        if (!disposed) notifyPointTransactions(history);
      } else {
        const history = await getTwaHistory();
        if (!disposed) seedKnownPointTransactions(history);
      }

      if (
        preferences.geoNotificationsEnabled &&
        getBrowserNotificationPermission() === "granted" &&
        Date.now() - lastGeoSyncAt.current >= GEO_SYNC_MS &&
        (await geolocationAlreadyGranted())
      ) {
        lastGeoSyncAt.current = Date.now();
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            if (disposed) return;
            const wallet = await getTwaWallet(true);
            if (disposed) return;
            notifyNearbyCompanies(wallet.companies, {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
          },
          () => undefined,
          { maximumAge: GEO_SYNC_MS, timeout: 8000, enableHighAccuracy: false },
        );
      }
    }

    void sync();
    const intervalId = window.setInterval(() => void sync(), POINTS_SYNC_MS);
    return () => {
      disposed = true;
      window.clearInterval(intervalId);
    };
  }, []);

  return null;
}
