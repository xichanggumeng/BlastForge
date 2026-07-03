import type { NAV_ITEMS } from "@/config/nav";

export type NavItem = (typeof NAV_ITEMS)[number];
export type NavKey = NavItem["key"];