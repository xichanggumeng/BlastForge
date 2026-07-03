/**
 * 公共环境变量读取。Phase 1 阶段只暴露 NEXT_PUBLIC_*。
 * 服务端密钥（DeepSeek、Database）由后续会话单独封装。
 */

export const PUBLIC_ENV = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "BlastForge",
  demoMode: (process.env.NEXT_PUBLIC_DEMO_MODE ?? "true").toLowerCase() !== "false",
} as const;

export type PublicEnv = typeof PUBLIC_ENV;