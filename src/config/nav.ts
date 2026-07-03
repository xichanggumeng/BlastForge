import {
  BookOpen,
  Bot,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  SlidersHorizontal,
  Workflow,
  type LucideIcon,
} from "lucide-react";

export type NavKey =
  | "overview"
  | "planner"
  | "agents"
  | "workflow"
  | "knowledge"
  | "approvals"
  | "reports";

export interface NavItem {
  key: NavKey;
  href: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
  group: "primary" | "secondary";
}

export const NAV_ITEMS: readonly NavItem[] = [
  {
    key: "overview",
    href: "/dashboard",
    label: "总览",
    shortLabel: "总览",
    description: "项目、Agent 与风险全景",
    icon: LayoutDashboard,
    group: "primary",
  },
  {
    key: "planner",
    href: "/planner",
    label: "参数规划",
    shortLabel: "规划",
    description: "工程参数录入与多方案规划",
    icon: SlidersHorizontal,
    group: "primary",
  },
  {
    key: "agents",
    href: "/agents",
    label: "Agent 工作台",
    shortLabel: "Agent",
    description: "Agent 池、工具与 Schema",
    icon: Bot,
    group: "primary",
  },
  {
    key: "workflow",
    href: "/workflow",
    label: "Workflow",
    shortLabel: "Workflow",
    description: "Agentic Workflow 执行视图",
    icon: Workflow,
    group: "primary",
  },
  {
    key: "knowledge",
    href: "/knowledge",
    label: "知识库",
    shortLabel: "知识",
    description: "文档来源与引用关系",
    icon: BookOpen,
    group: "primary",
  },
  {
    key: "approvals",
    href: "/approvals",
    label: "人工复核",
    shortLabel: "复核",
    description: "等待确认的检查项与历史",
    icon: ClipboardCheck,
    group: "primary",
  },
  {
    key: "reports",
    href: "/reports",
    label: "报告中心",
    shortLabel: "报告",
    description: "结构化报告与归档",
    icon: FileText,
    group: "primary",
  },
] as const;

export const MOBILE_NAV_ITEMS: readonly NavItem[] = NAV_ITEMS.filter(
  (item) => item.key !== "workflow" && item.key !== "agents",
);