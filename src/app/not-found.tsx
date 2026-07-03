import Link from "next/link";
import { Compass, Home } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/feedback/empty-state";

export const metadata = {
  title: "页面未找到",
};

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center px-6 py-16">
      <EmptyState
        title="404 · 页面未找到"
        description="该路径不存在或尚未在 Phase 1 阶段实现。可返回驾驶舱或首页继续浏览。"
        icon={Compass}
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button asChild>
              <Link href="/dashboard">
                <Home className="h-4 w-4" />
                <span>返回驾驶舱</span>
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/">
                <span>回到首页</span>
              </Link>
            </Button>
          </div>
        }
      />
    </div>
  );
}