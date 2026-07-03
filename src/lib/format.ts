/**
 * 公共格式化工具。Phase 1 范围内只暴露最少量：数字、单位与短日期。
 */

const numberFmt = new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: 3,
});

const percentFmt = new Intl.NumberFormat("zh-CN", {
  style: "percent",
  maximumFractionDigits: 1,
});

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return numberFmt.format(value);
}

export function formatPercent(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined || Number.isNaN(ratio)) return "—";
  return percentFmt.format(ratio);
}

export function formatWithUnit(
  value: number | null | undefined,
  unit: string | null | undefined,
  digits = 2,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const fixed = new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: digits,
  }).format(value);
  return unit ? `${fixed} ${unit}` : fixed;
}

const dateFmt = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDateTime(input: string | number | Date | null | undefined): string {
  if (input === null || input === undefined) return "—";
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return "—";
  return dateFmt.format(date);
}