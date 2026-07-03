"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/feedback/error-state";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (typeof console !== "undefined" && process.env.NODE_ENV !== "production") {
      console.error("[BlastForge] Page error:", error);
    }
  }, [error]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center gap-6 px-6 py-16">
      <ErrorState
        title="页面发生错误"
        description={
          error.message
            ? `${error.message}。可尝试重新加载或返回首页。`
            : "请稍后重试或返回首页。"
        }
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button onClick={reset} variant="primary">
              <RotateCcw className="h-4 w-4" />
              重试
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard">返回驾驶舱</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/">回到首页</Link>
            </Button>
          </div>
        }
      />
      {error.digest ? (
        <p className="text-xs text-muted-foreground">错误 ID：{error.digest}</p>
      ) : null}
    </div>
  );
}