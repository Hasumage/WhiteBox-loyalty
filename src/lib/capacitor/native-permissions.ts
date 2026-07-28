"use client";

type PermissionStateLike = "prompt" | "prompt-with-rationale" | "granted" | "denied" | string;

type NativeGeolocationPosition = {
  coords: {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    altitude?: number | null;
    altitudeAccuracy?: number | null;
    heading?: number | null;
    speed?: number | null;
  };
  timestamp?: number;
};

type NativePositionOptions = {
  enableHighAccuracy?: boolean;
  maximumAge?: number;
  timeout?: number;
};

type NativeGeolocationPlugin = {
  checkPermissions?: () => Promise<Record<string, PermissionStateLike>>;
  requestPermissions?: (options?: { permissions?: string[] }) => Promise<Record<string, PermissionStateLike>>;
  getCurrentPosition?: (options?: NativePositionOptions) => Promise<NativeGeolocationPosition>;
};

type NativeCameraPlugin = {
  checkPermissions?: () => Promise<Record<string, PermissionStateLike>>;
  requestPermissions?: (options?: { permissions?: string[] }) => Promise<Record<string, PermissionStateLike>>;
};

type CapacitorWindow = Window & {
  Capacitor?: {
    getPlatform?: () => string;
    isNativePlatform?: () => boolean;
    Plugins?: {
      Camera?: NativeCameraPlugin;
      Geolocation?: NativeGeolocationPlugin;
      Permissions?: {
        query?: (options: { name?: string; permission?: string }) => Promise<Record<string, PermissionStateLike>>;
        requestPermissions?: (options: { permissions: string[] }) => Promise<Record<string, PermissionStateLike>>;
      };
    };
  };
};

type NativeResult<T> =
  | { status: "ready"; value: T }
  | { status: "denied" }
  | { status: "unavailable" }
  | { status: "error"; error: unknown };

function getCapacitor() {
  if (typeof window === "undefined") return null;
  return (window as CapacitorWindow).Capacitor ?? null;
}

export function isNativeCapacitorRuntime() {
  const capacitor = getCapacitor();
  if (!capacitor) return false;
  if (capacitor.isNativePlatform?.() === true) return true;
  const platform = capacitor.getPlatform?.();
  return platform === "android" || platform === "ios";
}

function hasGrantedPermission(status?: Record<string, PermissionStateLike> | null) {
  if (!status) return false;
  return Object.values(status).some((value) => value === "granted");
}

function hasDeniedPermission(status?: Record<string, PermissionStateLike> | null) {
  if (!status) return false;
  return Object.values(status).some((value) => value === "denied");
}

function webGeolocationPosition(options?: NativePositionOptions) {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      reject(new Error("geolocation-unavailable"));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

function toWebGeolocationPosition(position: NativeGeolocationPosition): GeolocationPosition {
  const coords = {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: Number.isFinite(position.coords.accuracy) ? Number(position.coords.accuracy) : 0,
    altitude: position.coords.altitude ?? null,
    altitudeAccuracy: position.coords.altitudeAccuracy ?? null,
    heading: position.coords.heading ?? null,
    speed: position.coords.speed ?? null,
    toJSON() {
      return {
        latitude: this.latitude,
        longitude: this.longitude,
        accuracy: this.accuracy,
        altitude: this.altitude,
        altitudeAccuracy: this.altitudeAccuracy,
        heading: this.heading,
        speed: this.speed,
      };
    },
  } satisfies GeolocationCoordinates;

  return {
    coords,
    timestamp: position.timestamp ?? Date.now(),
    toJSON() {
      return {
        coords: this.coords,
        timestamp: this.timestamp,
      };
    },
  } satisfies GeolocationPosition;
}

async function requestNativeGeolocationPermission(geolocation: NativeGeolocationPlugin) {
  const current = await geolocation.checkPermissions?.();
  if (hasGrantedPermission(current)) return "granted";

  const requested = await geolocation
    .requestPermissions?.({ permissions: ["location", "coarseLocation"] })
    .catch(() => geolocation.requestPermissions?.());

  if (hasGrantedPermission(requested)) return "granted";
  if (hasDeniedPermission(requested) || hasDeniedPermission(current)) return "denied";

  return "denied";
}

export async function getCapacitorGeolocationPosition(
  options?: NativePositionOptions,
  permissionOptions: { prompt?: boolean } = {},
): Promise<NativeResult<NativeGeolocationPosition>> {
  const capacitor = getCapacitor();
  const geolocation = capacitor?.Plugins?.Geolocation;
  if (!isNativeCapacitorRuntime() || !geolocation?.getCurrentPosition) return { status: "unavailable" };

  try {
    const current = await geolocation.checkPermissions?.();
    let allowed = hasGrantedPermission(current);

    if (!allowed && permissionOptions.prompt !== false) {
      const permission = await requestNativeGeolocationPermission(geolocation);
      allowed = permission === "granted";
      if (!allowed) return { status: "denied" };
    }

    if (!allowed && hasDeniedPermission(current)) return { status: "denied" };
    if (!allowed) return { status: "denied" };

    return { status: "ready", value: await geolocation.getCurrentPosition(options) };
  } catch (error) {
    return { status: "error", error };
  }
}

export async function getGeolocationPosition(options?: NativePositionOptions) {
  const nativePosition = await getCapacitorGeolocationPosition(options);
  if (nativePosition.status === "ready") return toWebGeolocationPosition(nativePosition.value);
  if (nativePosition.status === "denied") throw new Error("geolocation-denied");

  return webGeolocationPosition(options);
}

export async function geolocationPermissionAlreadyGranted() {
  const capacitor = getCapacitor();
  const geolocation = capacitor?.Plugins?.Geolocation;

  if (isNativeCapacitorRuntime() && geolocation?.checkPermissions) {
    try {
      return hasGrantedPermission(await geolocation.checkPermissions());
    } catch {
      return false;
    }
  }

  if (typeof navigator === "undefined" || !navigator.permissions?.query) return false;

  try {
    const status = await navigator.permissions.query({ name: "geolocation" as PermissionName });
    return status.state === "granted";
  } catch {
    return false;
  }
}

export async function requestCapacitorCameraPermission(): Promise<"granted" | "denied" | "unavailable"> {
  const capacitor = getCapacitor();
  const camera = capacitor?.Plugins?.Camera;
  if (!isNativeCapacitorRuntime()) return "unavailable";

  try {
    const current = await camera?.checkPermissions?.();
    if (hasGrantedPermission(current)) return "granted";

    const requested = await camera
      ?.requestPermissions?.({ permissions: ["camera"] })
      .catch(() => camera?.requestPermissions?.());
    if (hasGrantedPermission(requested)) return "granted";

    const genericPermissions = capacitor?.Plugins?.Permissions;
    const genericRequested = await genericPermissions
      ?.requestPermissions?.({ permissions: ["camera"] })
      .catch(() => null);
    if (hasGrantedPermission(genericRequested)) return "granted";

    return hasDeniedPermission(requested) || hasDeniedPermission(genericRequested) || hasDeniedPermission(current)
      ? "denied"
      : "unavailable";
  } catch {
    return "unavailable";
  }
}
