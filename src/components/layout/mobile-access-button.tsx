"use client";

/**
 * MobileAccessButton —— PC 端右上角"手机上查看"入口，点击弹出二维码弹窗。
 *
 * 设计风格与项目保持一致：
 *  - 触发按钮使用 Button variant="outline" + Smartphone 图标
 *  - 弹窗使用原生 <dialog>（与 MobileNav 同模式），背景遮罩 + 项目 surface 卡片
 *  - 卡片内容使用 Surface/Card 的视觉语言：border-border、bg-surface、shadow-md
 *  - ESC 与点击遮罩关闭，a11y 标注
 */

import Image from "next/image";
import { Smartphone, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

const QR_IMAGE = {
  src: "/Url.png",
  alt: "爆擎 BlastForge 手机访问二维码",
  width: 400,
  height: 400,
} as const;

export function MobileAccessButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  // 同步 open state 与原生 <dialog> 的 show/close
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  // 弹窗打开时禁用 body 滚动
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        leftIcon={<Smartphone className="h-3.5 w-3.5" aria-hidden />}
        onClick={() => setOpen(true)}
        className={cn("hidden md:inline-flex", className)}
        aria-label="手机上查看"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        手机上查看
      </Button>

      <dialog
        ref={dialogRef}
        aria-label="手机上查看二维码"
        className={cn(
          "fixed inset-0 z-[70] m-0 h-screen max-h-screen w-screen max-w-none border-0 bg-transparent p-0 backdrop:bg-overlay",
        )}
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === dialogRef.current) setOpen(false);
        }}
      >
        <div
          role="document"
          className={cn(
            "absolute left-1/2 top-1/2 w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2",
            "rounded-xl border border-border bg-surface text-foreground shadow-md",
            "p-6",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface-elevated text-primary"
                >
                  <Smartphone className="h-4 w-4" />
                </span>
                <h2 className="text-base font-semibold leading-tight">
                  手机上查看
                </h2>
              </div>
              <p className="text-xs text-muted-foreground">
                用手机相机或微信扫描下方二维码，即可在移动端打开爆擎 BlastForge 工作台。
              </p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              aria-label="关闭弹窗"
              onClick={() => setOpen(false)}
              className="-mr-2 -mt-1"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div
            className={cn(
              "mt-5 flex flex-col items-center gap-3 rounded-lg border border-border bg-surface-elevated p-5",
            )}
          >
            <div
              className={cn(
                "relative aspect-square w-full max-w-[260px] overflow-hidden rounded-md border border-border bg-background p-2",
              )}
            >
              <Image
                src={QR_IMAGE.src}
                alt={QR_IMAGE.alt}
                width={QR_IMAGE.width}
                height={QR_IMAGE.height}
                className="h-full w-full object-contain"
              />
            </div>
            <Badge tone="primary" size="sm">
              移动端优化布局
            </Badge>
          </div>

          <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground">
            提示：移动端与桌面端共享同一份 Demo 数据，规划、复核与报告等模块均可直接在手机上继续操作。
          </p>
        </div>
      </dialog>
    </>
  );
}