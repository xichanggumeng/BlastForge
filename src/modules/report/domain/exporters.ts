import "server-only";

/**
 * Report Exporters —— Markdown / JSON / HTML 输出。
 *
 * HTML 输出针对打印 / 保存为 PDF 优化：
 *  - 单列布局；
 *  - 高对比文本；
 *  - 分页提示；
 *  - 不依赖外部浏览器服务；打印由浏览器原生 Print-to-PDF 完成。
 */

import type { Report } from "./contracts";

export function exportMarkdown(report: Report): string {
  const lines: string[] = [];
  lines.push(`# 报告 ${report.id}`);
  lines.push("");
  for (const section of report.sections) {
    lines.push(`## ${section.title}`);
    lines.push("");
    lines.push(section.body);
    lines.push("");
  }
  lines.push(`## 引用列表`);
  for (const c of report.citations) {
    const citation = c as {
      id: string;
      documentTitle: string;
      excerpt: string;
      score: number;
      category: string;
    };
    lines.push(`- **${citation.documentTitle}**（${citation.category} · ${(citation.score * 100).toFixed(0)}%）：${citation.excerpt}`);
  }
  lines.push("");
  lines.push(`## 责任边界`);
  lines.push(report.responsibilityBoundary);
  return lines.join("\n");
}

export function exportJSON(report: Report): string {
  return JSON.stringify(report, null, 2);
}

export function exportHTML(report: Report): string {
  const sections = report.sections
    .map(
      (s) => `
  <section class="report-section">
    <h2>${escapeHtml(s.title)}</h2>
    ${renderMarkdownLite(s.body)}
  </section>`,
    )
    .join("");
  const citationList = report.citations
    .map((c) => {
      const ci = c as {
        documentTitle: string;
        category: string;
        score: number;
        excerpt: string;
      };
      return `<li><strong>${escapeHtml(ci.documentTitle)}</strong>（${escapeHtml(ci.category)} · ${(ci.score * 100).toFixed(0)}%）：${escapeHtml(ci.excerpt)}</li>`;
    })
    .join("");
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(report.id)} · BlastForge Demo 报告</title>
<style>
  :root {
    --fg: #0b0f17;
    --muted: #4b5563;
    --accent: #1d4ed8;
    --border: #d4d4d8;
    --bg: #ffffff;
  }
  @media print {
    body { font-size: 11pt; }
    .report-section, header, footer { break-inside: avoid; page-break-inside: avoid; }
    .no-print { display: none !important; }
  }
  body { font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; color: var(--fg); background: var(--bg); margin: 32px; line-height: 1.55; }
  header { border-bottom: 1px solid var(--border); padding-bottom: 12px; margin-bottom: 18px; }
  header h1 { margin: 0 0 6px; font-size: 22pt; }
  header p { margin: 2px 0; color: var(--muted); font-size: 11pt; }
  .report-section { margin: 14px 0 18px; padding: 12px 14px; border: 1px solid var(--border); border-radius: 8px; }
  .report-section h2 { margin: 0 0 8px; font-size: 14pt; color: var(--accent); }
  .report-section h3 { margin: 6px 0; font-size: 12pt; }
  .report-section pre { white-space: pre-wrap; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10.5pt; color: var(--fg); }
  ul { padding-left: 18px; }
  li { margin: 4px 0; }
  footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid var(--border); color: var(--muted); font-size: 10pt; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--border); font-size: 10pt; }
  .badge.warn { background: #fff7ed; color: #9a3412; border-color: #fdba74; }
  .badge.ok { background: #ecfdf5; color: #065f46; border-color: #6ee7b7; }
</style>
</head>
<body>
  <header>
    <h1>爆擎 BlastForge · 工程规划报告</h1>
    <p><span class="badge ${report.status === "approved" ? "ok" : "warn"}">${escapeHtml(report.status)}</span> · Run ${escapeHtml(report.runId)} · ${escapeHtml(report.scenarioName)}</p>
    <p>生成时间：${escapeHtml(report.createdAt)} · 责任人：${escapeHtml(report.generatedBy)}</p>
    ${report.replay ? '<p><span class="badge warn">演示回放模式</span> 模型不可用，自动回放至预录制 Run。</p>' : ""}
  </header>
  ${sections}
  <section class="report-section">
    <h2>引用列表</h2>
    <ul>${citationList}</ul>
  </section>
  <section class="report-section">
    <h2>安全与责任边界</h2>
    <pre>${escapeHtml(report.responsibilityBoundary)}</pre>
  </section>
  <footer>本报告由 BlastForge Demo 自动生成；不构成正式工程设计文件；现场决策必须以现行规范与具备资质人员的签字为准。</footer>
</body>
</html>`;
}

function renderMarkdownLite(md: string): string {
  // 极简 Markdown 渲染：只覆盖 ## / ### / - / **。避免引入 markdown 库以保持轻量。
  const lines = md.split("\n");
  const out: string[] = [];
  let inList = false;
  for (const raw of lines) {
    const line = raw.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    if (line.startsWith("## ")) {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      out.push(`<h3>${line.slice(3)}</h3>`);
    } else if (line.startsWith("- ")) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${line.slice(2)}</li>`);
    } else if (line.trim() === "") {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      out.push("");
    } else {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      out.push(`<p>${line}</p>`);
    }
  }
  if (inList) out.push("</ul>");
  return out.join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}