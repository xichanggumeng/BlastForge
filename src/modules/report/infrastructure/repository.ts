import "server-only";

import type { Report } from "../domain/contracts";

/**
 * Report Repository —— InMemory 存储；可替换为 Drizzle / PostgreSQL。
 *
 * 设计：
 *  - reports: 按 id 索引；
 *  - byRun: 同一 Run 只能存在一份"主"报告（允许多份但 UI 默认展示第一份）；
 *  - list: 按 updatedAt 倒序返回前 N 条。
 */

class ReportRepository {
  private readonly reports = new Map<string, Report>();
  private readonly byRun = new Map<string, string>();

  save(report: Report): Report {
    this.reports.set(report.id, report);
    if (!this.byRun.has(report.runId)) {
      this.byRun.set(report.runId, report.id);
    } else {
      this.byRun.set(report.runId, report.id);
    }
    return report;
  }

  get(id: string): Report | undefined {
    return this.reports.get(id);
  }

  getByRun(runId: string): Report | undefined {
    const id = this.byRun.get(runId);
    return id ? this.reports.get(id) : undefined;
  }

  list(limit = 20): ReadonlyArray<Report> {
    return Array.from(this.reports.values())
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit);
  }
}

let instance: ReportRepository | null = null;
export function getReportRepository(): ReportRepository {
  if (!instance) instance = new ReportRepository();
  return instance;
}

export function resetReportRepository(): void {
  instance = null;
}