"use client";

import { InternalIcon } from "@/components/icons/internal-icon-collection";

type Props = {
  iconName: string;
  className?: string;
};

export function CategoryIcon({ iconName, className }: Props) {
  return <InternalIcon icon={iconName} fallback="Circle" className={className} />;
}
