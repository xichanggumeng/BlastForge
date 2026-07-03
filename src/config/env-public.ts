/**
 * 仅暴露给浏览器端的运行时配置。所有值必须在 NEXT_PUBLIC_ 前缀下。
 */
export const RUNTIME_CONFIG = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "BlastForge",
  demoMode: (process.env.NEXT_PUBLIC_DEMO_MODE ?? "true").toLowerCase() !== "false",
} as const;

export type RuntimeConfig = typeof RUNTIME_CONFIG;