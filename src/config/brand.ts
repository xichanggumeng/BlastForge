export const BRAND = {
  name: "爆擎 BlastForge",
  shortName: "BlastForge",
  tagline: "AI 原生爆破工程辅助决策与协同平台",
  logo: {
    src: "/Logo.jpg",
    alt: "爆擎 BlastForge",
    width: 36,
    height: 36,
  },
  favicon: {
    src: "/Icon.ico",
    apple: "/Icon.jpg",
  },
} as const;

export type Brand = typeof BRAND;