import Image from "next/image";
import { BRAND } from "@/config/brand";
import { cn } from "@/lib/cn";

export interface BrandMarkProps {
  className?: string;
  size?: number;
  showName?: boolean;
  nameClassName?: string;
}

/**
 * Compact brand mark composed of the product icon + product name.
 * Uses the dedicated favicon asset (`Icon.ico`) — Logo.jpg is a brand photo
 * and is reserved for explicit showcase usage, not icon slots.
 */
export function BrandMark({
  className,
  size = 48,
  showName = true,
  nameClassName,
}: BrandMarkProps) {
  return (
    <div className={cn("inline-flex items-center gap-3", className)}>
      <span
        aria-hidden
        className="relative inline-flex items-center justify-center overflow-hidden rounded-lg border border-border bg-surface shadow-sm"
        style={{ width: size, height: size }}
      >
        <Image
          src={BRAND.icon.src}
          alt=""
          width={size}
          height={size}
          className="h-full w-full object-contain"
        />
      </span>
      {showName ? (
        <span className={cn("flex flex-col leading-tight", nameClassName)}>
          <span className="text-sm font-semibold text-foreground">{BRAND.name}</span>
          <span className="text-[11px] text-muted-foreground">{BRAND.tagline}</span>
        </span>
      ) : null}
    </div>
  );
}