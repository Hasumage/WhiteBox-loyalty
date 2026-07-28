"use client";

import { useEffect, useState } from "react";

const CAPACITOR_APP_FLAG_KEY = "nearloy:capacitor-app";
const CAPACITOR_APP_QUERY_FLAGS = new Set(["capacitor", "native", "mobile-app"]);

type CapacitorWindow = Window & {
  Capacitor?: {
    getPlatform?: () => string;
    isNativePlatform?: () => boolean;
  };
};

function detectCapacitorApp() {
  if (typeof window === "undefined") return false;

  const capacitorWindow = window as CapacitorWindow;
  const platform = capacitorWindow.Capacitor?.getPlatform?.();
  const storedFlag = readStoredCapacitorFlag();
  const queryFlag = readQueryCapacitorFlag();

  if (queryFlag) {
    writeStoredCapacitorFlag();
  }

  return (
    capacitorWindow.Capacitor?.isNativePlatform?.() === true ||
    (typeof platform === "string" && platform !== "web") ||
    window.location.protocol === "capacitor:" ||
    window.location.protocol === "ionic:" ||
    storedFlag ||
    queryFlag ||
    /NearLoyCapacitor|Capacitor/i.test(window.navigator.userAgent)
  );
}

function readQueryCapacitorFlag() {
  const params = new URLSearchParams(window.location.search);
  const app = params.get("app")?.toLowerCase();

  return (
    app === "capacitor" ||
    app === "native" ||
    Array.from(CAPACITOR_APP_QUERY_FLAGS).some((flag) => params.get(flag) === "1")
  );
}

function readStoredCapacitorFlag() {
  try {
    return window.localStorage.getItem(CAPACITOR_APP_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

function writeStoredCapacitorFlag() {
  try {
    window.localStorage.setItem(CAPACITOR_APP_FLAG_KEY, "1");
  } catch {
  }
}

export function useIsCapacitorApp() {
  const [isCapacitorApp, setIsCapacitorApp] = useState<boolean | null>(null);

  useEffect(() => {
    setIsCapacitorApp(detectCapacitorApp());
  }, []);

  return isCapacitorApp;
}
