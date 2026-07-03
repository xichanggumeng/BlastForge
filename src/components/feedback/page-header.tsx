import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  meta?: ReactNode;
  icon?: LucideIcon;
  className?: string;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
  icon: Icon,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={
        "flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between " +
        (className ?? "")
      }
    >
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : null}
          {eyebrow ? <span>{eyebrow}</span> : null}
        </div>
        <h1 className="text-2xl font-semibold leading-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        ) : null}
        {meta ? <div className="flex flex-wrap gap-2 pt-1">{meta}</div> : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}