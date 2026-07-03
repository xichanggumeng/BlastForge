import { BRAND } from "@/config/brand";

export function ShowcaseFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="flex flex-col gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span>
        © {year} {BRAND.name} · 当前为模拟演示，所有结果仅供方案讨论与会议展示。
      </span>
      <span className="inline-flex items-center gap-2">
        <span>Phase 2 · 品牌首页、智能驾驶舱与展示动画</span>
        <span aria-hidden>·</span>
        <span>deepseek-v4-pro</span>
      </span>
    </footer>
  );
}