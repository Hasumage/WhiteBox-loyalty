import { ServiceUnavailableException } from "@nestjs/common";

export function subscriptionsEnabled() {
  return process.env.SUBSCRIPTIONS_ENABLED === "true" || process.env.NEXT_PUBLIC_SUBSCRIPTIONS_ENABLED === "true";
}

export function assertSubscriptionsEnabled() {
  if (!subscriptionsEnabled()) {
    throw new ServiceUnavailableException("Subscriptions are not available in the first release.");
  }
}
