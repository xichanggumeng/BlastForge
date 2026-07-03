import "server-only";

/**
 * Report Exporters —— Markdown / JSON / HTML / PDF 输出。
 *
 * HTML 输出针对打印 / 保存为 PDF 优化：
 *  - 单列布局；
 *  - 高对比文本；
 *  - 分页提示；
 *  - 不依赖外部浏览器服务；打印由浏览器原生 Print-to-PDF 完成。
 *  - 服务端 puppeteer 也可以直接渲染同一份 HTML 输出 PDF（见 pdf-renderer.ts）。
 *
 * 视觉规范：
 *  - 封面页：品牌色大标题 + 报告编号 / Run / 时间 / 责任人 / 状态徽章 + 工程条件快览；
 *  - 章节评分：用 CSS Grid 卡片化展示（无 ECharts 依赖，PDF 内不再失踪）；
 *  - 引用 / 复核：卡片化；
 *  - @page 页眉页脚：报告编号 + 页码。
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
    lines.push(
      `- **${citation.documentTitle}**（${citation.category} · ${(
        citation.score * 100
      ).toFixed(0)}%）：${citation.excerpt}`,
    );
  }
  lines.push("");
  lines.push(`## 责任边界`);
  lines.push(report.responsibilityBoundary);
  return lines.join("\n");
}

export function exportJSON(report: Report): string {
  return JSON.stringify(report, null, 2);
}

interface SchemeForCard {
  id: string;
  tag: string;
  category: string;
  applicability: string;
  score: { safety: number; suitability: number; economy: number; convenience: number; environment: number; overall: number };
  predictedParameters?: ReadonlyArray<{ label: string; value: number; unit: string }>;
  risks?: ReadonlyArray<string>;
}

interface CitationCard {
  id: string;
  documentTitle: string;
  excerpt: string;
  score: number;
  category: string;
  matchedTokens?: ReadonlyArray<string>;
  usedByAgents?: ReadonlyArray<string>;
  affectedConclusions?: ReadonlyArray<string>;
}

function renderSchemesSectionForHtml(recommended: SchemeForCard | undefined, alternatives: ReadonlyArray<SchemeForCard>, riskSchemes: ReadonlyArray<SchemeForCard>): string {
  const card = (s: SchemeForCard, badgeTone: string): string => `
    <article class="scheme-card scheme-card--${badgeTone}">
      <header class="scheme-card__header">
        <span class="scheme-card__tag">${escapeHtml(s.tag)}</span>
        <span class="scheme-card__badge scheme-card__badge--${badgeTone}">${escapeHtml(s.category)}</span>
      </header>
      <p class="scheme-card__app">${escapeHtml(s.applicability)}</p>
      <div class="scheme-card__scores">
        ${renderScoreRow("安全", s.score.safety)}
        ${renderScoreRow("适配", s.score.suitability)}
        ${renderScoreRow("经济", s.score.economy)}
        ${renderScoreRow("便利", s.score.convenience)}
        ${renderScoreRow("环境", s.score.environment)}
        ${renderScoreRow("综合", s.score.overall, true)}
      </div>
      ${s.predictedParameters && s.predictedParameters.length > 0
        ? `<details class="scheme-card__details"><summary>关键参数（前 5）</summary><ul>${s.predictedParameters
            .slice(0, 5)
            .map((p) => `<li>${escapeHtml(p.label)}：${p.value.toFixed(2)} ${escapeHtml(p.unit)}</li>`)
            .join("")}</ul></details>`
        : ""
      }
      ${s.risks && s.risks.length > 0
        ? `<details class="scheme-card__details"><summary>风险提示</summary><ul>${s.risks
            .map((r) => `<li>${escapeHtml(r)}</li>`)
            .join("")}</ul></details>`
        : ""
      }
    </article>
  `;
  const list = (title: string, tone: string, items: ReadonlyArray<SchemeForCard>): string => `
    <section class="scheme-group">
      <h3>${escapeHtml(title)}</h3>
      ${items.length > 0
        ? `<div class="scheme-grid">${items.map((s) => card(s, tone)).join("")}</div>`
        : '<p class="muted">_无_</p>'
      }
    </section>
  `;
  return `
    ${list("推荐方案", "primary", recommended ? [recommended] : [])}
    ${list("备选方案", "neutral", alternatives)}
    ${list("风险 / 不推荐方案", "danger", riskSchemes)}
  `;
}

function renderScoreRow(label: string, score: number, highlight = false): string {
  const num = Math.max(0, Math.min(100, Math.round(score)));
  return `
    <div class="scheme-card__score ${highlight ? "scheme-card__score--overall" : ""}">
      <span class="scheme-card__score-label">${escapeHtml(label)}</span>
      <span class="scheme-card__score-value">${num}</span>
      <span class="scheme-card__score-bar"><span style="width:${num}%"></span></span>
    </div>
  `;
}

function extractSchemesFromSections(report: Report): {
  recommended?: SchemeForCard;
  alternatives: SchemeForCard[];
  riskSchemes: SchemeForCard[];
} {
  const schemesSection = report.sections.find((s) => s.key === "schemes");
  const recommended: SchemeForCard[] = [];
  const alternatives: SchemeForCard[] = [];
  const riskSchemes: SchemeForCard[] = [];

  if (!schemesSection) return { recommended: recommended[0], alternatives, riskSchemes };

  // 解析 body 中的方案结构：section body 内含 「### 推荐方案」、### 备选方案、### 风险 / 不推荐方案
  // 这里用更简单的方式——从 buildReport 注入的数据中拿不到，需要 client 解析；
  // 为了完整渲染，我们直接从 schemesSection.body 中挖 **...**（tag）段落。
  const blocks = schemesSection.body.split(/###\s+/).map((s) => s.trim()).filter(Boolean);
  const grab = (label: string, list: SchemeForCard[]): void => {
    const block = blocks.find((b) => b.startsWith(label));
    if (!block) return;
    const body = block.slice(label.length).trim();
    const tagMatch = body.match(/\*\*([^*]+)\*\*\s*·\s*([^*\n]+)/);
    if (!tagMatch) return;
    const tag = tagMatch[1]?.trim() ?? label;
    const applicability = tagMatch[2]?.trim() ?? "";
    list.push({
      id: tag,
      tag,
      category: label,
      applicability,
      score: { safety: 0, suitability: 0, economy: 0, convenience: 0, environment: 0, overall: 0 },
    });
  };
  grab("推荐方案", recommended);
  grab("备选方案", alternatives);
  grab("风险 / 不推荐方案", riskSchemes);

  // 为评分卡填充评分值：从 scores 章节解析（依赖 buildReport 的输出格式）
  const scoresSection = report.sections.find((s) => s.key === "scores");
  if (scoresSection) {
    const fillScores = (cards: SchemeForCard[]): void => {
      for (const card of cards) {
        const re = new RegExp(
          `${escapeRegExp(card.tag)}\\s*\\([^)]*\\)：([^\\n]+)`,
        );
        const line = scoresSection.body.match(re)?.[1];
        if (!line) continue;
        const nums = (line.match(/\d+/g) ?? []).map((n) => Number(n));
        if (nums.length >= 6) {
          card.score = {
            safety: nums[0]!,
            suitability: nums[1]!,
            economy: nums[2]!,
            convenience: nums[3]!,
            environment: nums[4]!,
            overall: nums[5]!,
          };
        }
      }
    };
    fillScores(recommended);
    fillScores(alternatives);
    fillScores(riskSchemes);
  }

  return {
    recommended: recommended[0],
    alternatives,
    riskSchemes,
  };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const CHART_SENTINEL_RE = /::chart-(radar|bars|heatmap)::([\s\S]*?)::/g;

export function exportHTML(report: Report): string {
  const { recommended, alternatives, riskSchemes } = extractSchemesFromSections(report);
  const schemesHtml = renderSchemesSectionForHtml(recommended, alternatives, riskSchemes);

  const sectionsHtml = report.sections
    .filter((s) => s.key !== "schemes" && s.key !== "citations")
    .map((s) => renderReportSectionHtml(s))
    .join("");

  const citationCards = (report.citations as ReadonlyArray<CitationCard>).length === 0
    ? '<p class="muted">本次 Run 未命中任何知识引用；请在 Planner 内主动补充检索。</p>'
    : `<div class="citation-grid">${
        (report.citations as ReadonlyArray<CitationCard>)
          .map(
            (c) => `
        <article class="citation-card">
          <header class="citation-card__head">
            <span class="citation-card__title">${escapeHtml(c.documentTitle)}</span>
            <span class="citation-card__badge">${escapeHtml(c.category)} · ${(c.score * 100).toFixed(0)}%</span>
          </header>
          <blockquote class="citation-card__excerpt">${escapeHtml(c.excerpt)}</blockquote>
          ${
            c.matchedTokens && c.matchedTokens.length > 0
              ? `<p class="citation-card__meta"><strong>命中关键词：</strong>${c.matchedTokens
                  .slice(0, 8)
                  .map((t) => escapeHtml(t))
                  .join("、")}</p>`
              : ""
          }
          ${
            c.usedByAgents && c.usedByAgents.length > 0
              ? `<p class="citation-card__meta"><strong>使用 Agent：</strong>${c.usedByAgents
                  .map((t) => escapeHtml(t))
                  .join("、")}</p>`
              : ""
          }
          ${
            c.affectedConclusions && c.affectedConclusions.length > 0
              ? `<p class="citation-card__meta"><strong>影响结论：</strong>${c.affectedConclusions
                  .map((t) => escapeHtml(t))
                  .join("、")}</p>`
              : ""
          }
        </article>
      `,
          )
          .join("")
      }</div>`;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(report.id)} · BlastForge Demo 报告</title>
<style>
  :root {
    --fg: #0b0f17;
    --fg-soft: #1f2937;
    --muted: #4b5563;
    --accent: #c2410c;          /* BlastForge 品牌橙：爆破橙 */
    --accent-soft: #fff7ed;
    --border: #e5e7eb;
    --border-strong: #d4d4d8;
    --bg: #ffffff;
    --bg-soft: #f8fafc;
    --success: #047857;
    --warning: #b45309;
    --danger: #b91c1c;
  }
  @page {
    size: A4;
    margin: 18mm 14mm 20mm 14mm;
    @top-left {
      content: "BlastForge Demo · 报告 ${escapeHtml(report.id)}";
      font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
      font-size: 9pt;
      color: #6b7280;
    }
    @top-right {
      content: "${escapeHtml(report.scenarioName)}";
      font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
      font-size: 9pt;
      color: #6b7280;
    }
    @bottom-center {
      content: "第 " counter(page) " 页 / 共 " counter(pages) " 页";
      font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
      font-size: 9pt;
      color: #6b7280;
    }
  }
  @media print {
    body { font-size: 11pt; }
    .no-print, .report-section.cover { break-after: page; }
    .report-section { break-inside: avoid; page-break-inside: avoid; }
    h1, h2, h3 { page-break-after: avoid; }
  }
  body {
    font-family: -apple-system, "PingFang SC", "Microsoft YaHei", "Source Han Sans CN", sans-serif;
    color: var(--fg);
    background: var(--bg);
    margin: 0;
    line-height: 1.65;
  }
  h1, h2, h3 { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; }
  h2 { font-size: 14pt; color: var(--accent); margin: 0 0 10px; border-bottom: 1px solid var(--border); padding-bottom: 6px; }
  h3 { font-size: 12pt; color: var(--fg-soft); margin: 10px 0 6px; }
  p { margin: 0 0 8px; }
  ul { padding-left: 18px; margin: 0 0 10px; }
  li { margin: 3px 0; }
  pre { white-space: pre-wrap; font-family: ui-monospace, "JetBrains Mono", Menlo, monospace; font-size: 10pt; color: var(--fg); }
  .muted { color: var(--muted); font-size: 10pt; }

  /* ===== 封面 ===== */
  section.cover {
    text-align: center;
    padding: 36px 24px 24px;
    border: 1px solid var(--border-strong);
    border-radius: 12px;
    background: linear-gradient(135deg, #fff7ed 0%, #ffffff 60%);
    page-break-after: always;
  }
  section.cover .brand-eyebrow {
    text-transform: uppercase;
    letter-spacing: 0.32em;
    font-size: 9pt;
    color: var(--muted);
    margin-bottom: 16px;
  }
  section.cover h1 {
    margin: 6px 0 18px;
    font-size: 28pt;
    color: var(--accent);
    letter-spacing: 0.04em;
  }
  section.cover .tagline {
    margin: 0 0 26px;
    font-size: 12pt;
    color: var(--fg-soft);
  }
  section.cover .meta-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px 20px;
    text-align: left;
    margin: 0 auto 22px;
    max-width: 480px;
  }
  section.cover .meta-grid > div {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.7);
  }
  section.cover .meta-grid .label {
    font-size: 9pt;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: var(--muted);
  }
  section.cover .meta-grid .value {
    font-size: 11pt;
    color: var(--fg);
    font-weight: 600;
  }
  section.cover .badge-row {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
  }
  section.cover .badge {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 999px;
    border: 1px solid var(--border-strong);
    font-size: 10pt;
  }
  section.cover .badge.ok { background: #ecfdf5; color: var(--success); border-color: #6ee7b7; }
  section.cover .badge.warn { background: #fff7ed; color: var(--warning); border-color: #fdba74; }
  section.cover .badge.replay { background: #fef2f2; color: var(--danger); border-color: #fca5a5; }
  section.cover .footer-note {
    margin-top: 26px;
    font-size: 9pt;
    color: var(--muted);
    border-top: 1px dashed var(--border-strong);
    padding-top: 12px;
  }

  /* ===== 普通章节 ===== */
  main { padding: 0 4px; }
  .report-section {
    margin: 14px 0 18px;
    padding: 12px 14px 14px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--bg);
  }
  .report-section h2 + p, .report-section h2 + ul { margin-top: 6px; }

  /* ===== 评分卡 ===== */
  .scheme-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
  }
  .scheme-card {
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 12px 14px;
    background: var(--bg);
  }
  .scheme-card--primary { border-left: 4px solid var(--accent); }
  .scheme-card--neutral { border-left: 4px solid #94a3b8; }
  .scheme-card--danger { border-left: 4px solid var(--danger); }
  .scheme-card__header {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 6px;
  }
  .scheme-card__tag { font-weight: 700; font-size: 11.5pt; color: var(--fg); }
  .scheme-card__badge {
    font-size: 9pt; padding: 2px 8px; border-radius: 999px;
    border: 1px solid var(--border);
  }
  .scheme-card__badge--primary { background: #fff7ed; color: var(--accent); border-color: #fdba74; }
  .scheme-card__badge--neutral { background: #f1f5f9; color: #475569; }
  .scheme-card__badge--danger { background: #fef2f2; color: var(--danger); border-color: #fca5a5; }
  .scheme-card__app { color: var(--muted); font-size: 10pt; margin: 0 0 8px; }
  .scheme-card__scores {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px 14px;
  }
  .scheme-card__score {
    display: grid; grid-template-columns: auto 30px 1fr;
    align-items: center; gap: 4px 6px;
  }
  .scheme-card__score-label { font-size: 9pt; color: var(--muted); }
  .scheme-card__score-value { font-weight: 700; font-size: 11pt; color: var(--fg); text-align: right; }
  .scheme-card__score-bar {
    grid-column: 1 / -1; display: block; height: 4px; border-radius: 2px; background: #f3f4f6; overflow: hidden;
  }
  .scheme-card__score-bar > span { display: block; height: 100%; background: linear-gradient(90deg, var(--accent), #f97316); }
  .scheme-card__score--overall .scheme-card__score-value { color: var(--accent); font-size: 12pt; }
  .scheme-card__score--overall .scheme-card__score-bar > span { background: var(--accent); }
  .scheme-card__details { margin-top: 8px; font-size: 10pt; color: var(--fg-soft); }
  .scheme-card__details summary { cursor: pointer; color: var(--accent); }
  .scheme-group { margin-bottom: 16px; }
  .scheme-group > h3 { font-size: 11pt; margin-bottom: 6px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.18em; }

  /* ===== 引用卡 ===== */
  .citation-grid { display: grid; grid-template-columns: 1fr; gap: 10px; }
  .citation-card {
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px 12px;
    background: var(--bg-soft);
  }
  .citation-card__head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; gap: 6px; }
  .citation-card__title { font-weight: 700; font-size: 11pt; }
  .citation-card__badge { font-size: 9pt; padding: 2px 8px; border-radius: 999px; background: #fff; border: 1px solid var(--border); color: var(--muted); }
  .citation-card__excerpt { font-size: 10.5pt; color: var(--fg-soft); border-left: 3px solid var(--accent); padding: 6px 10px; background: #fff; border-radius: 4px; margin: 0 0 6px; }
  .citation-card__meta { font-size: 9.5pt; color: var(--muted); margin: 0 0 2px; }
  .citation-card__meta strong { color: var(--fg-soft); }

  /* ===== 其它 ===== */
  ul { padding-left: 18px; }
  li { margin: 3px 0; }

  /* ===== 图表容器 ===== */
  .chart-figure { margin: 10px 0 4px; padding: 12px 14px; border: 1px dashed var(--border); border-radius: 10px; background: var(--bg-soft); }
  .chart-legend { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 8px; font-size: 9.5pt; color: var(--muted); }
  .chart-legend__item { display: inline-flex; align-items: center; gap: 4px; }
  .chart-legend__item i { width: 10px; height: 10px; border-radius: 2px; display: inline-block; border: 1px solid var(--border); }
  .chart-legend__muted { font-size: 9pt; }

  /* 雷达图 */
  .radar-svg { width: 100%; height: auto; max-width: 460px; display: block; margin: 0 auto; }
  .radar-ring { fill: none; stroke: var(--border); stroke-width: 0.5; }
  .radar-axis { stroke: var(--border); stroke-width: 0.5; }
  .radar-axis-label { font-size: 10pt; fill: var(--fg-soft); font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; }
  .radar-poly { transition: fill-opacity 120ms; }

  /* 柱状对比图 */
  .bars-header { display: grid; grid-template-columns: 120px 1fr; gap: 4px; padding: 0 4px 6px; border-bottom: 1px solid var(--border); font-size: 9.5pt; }
  .bars-header__cell { padding-left: 6px; font-weight: 600; }
  .bars-body { display: flex; flex-direction: column; }
  .bar-row { display: grid; grid-template-columns: 120px 1fr; gap: 6px; padding: 4px 4px; border-bottom: 1px dotted var(--border); }
  .bar-row:last-child { border-bottom: none; }
  .bar-row__label { font-size: 9.5pt; color: var(--fg-soft); font-weight: 600; }
  .bar-row__unit { color: var(--muted); font-weight: 400; margin-left: 2px; font-size: 9pt; }
  .bar-row__cells { display: flex; flex-direction: column; gap: 3px; }
  .bar-cell { position: relative; height: 14px; border-radius: 3px; background: #f3f4f6; overflow: hidden; display: flex; align-items: center; }
  .bar-cell__fill { position: absolute; left: 0; top: 0; height: 100%; border-radius: 3px 0 0 3px; }
  .bar-cell__label { position: relative; padding-left: 6px; font-size: 8.5pt; color: var(--fg-soft); z-index: 1; }
  .bar-cell--empty { background: #f9fafb; color: var(--muted); font-size: 8.5pt; align-items: center; justify-content: center; }

  /* 热力图 */
  .heatmap-table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  .heatmap-corner { background: var(--bg-soft); padding: 4px 6px; text-align: left; }
  .heatmap-head { padding: 4px 6px; background: var(--bg-soft); font-weight: 600; color: var(--fg-soft); text-align: center; }
  .heatmap-head--max { background: var(--accent-soft); color: var(--accent); }
  .heatmap-row-label { padding: 4px 6px; text-align: left; background: var(--bg-soft); color: var(--fg-soft); font-weight: 600; font-size: 9pt; max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .heatmap-cell { padding: 4px 6px; text-align: center; font-family: ui-monospace, "JetBrains Mono", Menlo, monospace; font-size: 9pt; border: 1px solid #fff; }
  .heatmap-cell--empty { background: #f9fafb; color: var(--muted); }
  .heatmap-cell--rowmax, .heatmap-cell--colavg { background: var(--bg-soft); font-weight: 600; color: var(--fg); }
  .heatmap-cell--grand { background: var(--accent-soft); color: var(--accent); font-weight: 700; }

  /* 风险 / 复核 / 决策卡片 */
  .risk-summary { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 8px 10px; margin: 10px 0 0; border-radius: 8px; background: var(--bg-soft); border: 1px solid var(--border); font-size: 9.5pt; }
  .risk-summary__chip { display: inline-flex; padding: 2px 8px; border-radius: 999px; font-weight: 600; font-size: 9pt; }
  .risk-summary__chip--high { background: #fef2f2; color: var(--danger); border: 1px solid #fca5a5; }
  .risk-summary__chip--medium { background: #fff7ed; color: var(--warning); border: 1px solid #fdba74; }
  .risk-summary__chip--low { background: #ecfdf5; color: var(--success); border: 1px solid #6ee7b7; }
  .risk-summary__hint { color: var(--muted); font-size: 9pt; }

  .review-hint { margin: 10px 0 0; padding: 8px 10px; border-radius: 8px; background: #fff7ed; border: 1px solid #fdba74; color: var(--warning); font-size: 9.5pt; }

  .decision-card { margin: 12px 0 4px; padding: 14px 16px; border-radius: 12px; background: linear-gradient(135deg, #fff7ed 0%, #ffffff 70%); border: 1.5px solid var(--accent); }
  .decision-card__title { font-size: 11pt; font-weight: 700; color: var(--accent); letter-spacing: 0.1em; margin-bottom: 6px; text-transform: uppercase; }
  .decision-card p { margin: 0; color: var(--fg); font-size: 11pt; line-height: 1.7; }
</style>
</head>
<body>
  <section class="cover report-section" data-key="cover">
    <div class="brand-eyebrow">BlastForge Demo · 工程规划报告</div>
    <h1>${escapeHtml(report.scenarioName)}</h1>
    <p class="tagline">由多 Agent 协作、RAG 检索与人工复核生成的爆破参数规划与方案对比报告。</p>
    <div class="badge-row">
      <span class="badge ${report.status === "approved" ? "ok" : "warn"}">${escapeHtml(report.status)}</span>
      ${report.replay ? '<span class="badge replay">演示回放模式</span>' : ""}
    </div>
    <div class="meta-grid">
      <div><span class="label">报告编号</span><span class="value">${escapeHtml(report.id)}</span></div>
      <div><span class="label">关联 Run</span><span class="value">${escapeHtml(report.runId)}</span></div>
      <div><span class="label">生成时间</span><span class="value">${escapeHtml(report.createdAt)}</span></div>
      <div><span class="label">责任人</span><span class="value">${escapeHtml(report.generatedBy)}</span></div>
      <div><span class="label">引用条数</span><span class="value">${report.citations.length} 条</span></div>
      <div><span class="label">章节数</span><span class="value">${report.sections.length} 个</span></div>
    </div>
    <p class="footer-note">本报告由 BlastForge Demo 自动生成；不构成正式工程设计文件；现场决策必须以现行规范与具备资质人员的签字为准。</p>
  </section>

  <main>
    ${sectionsHtml}
    <section class="report-section" data-key="schemes">
      <h2>推荐 / 备选 / 风险方案</h2>
      ${schemesHtml}
    </section>
    <section class="report-section" data-key="citations">
      <h2>知识引用（${report.citations.length}）</h2>
      ${citationCards}
    </section>
    <section class="report-section" data-key="responsibility">
      <h2>安全与责任边界</h2>
      <pre>${escapeHtml(report.responsibilityBoundary)}</pre>
    </section>
  </main>
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

/**
 * 渲染单个 ReportSection 为 HTML。
 *
 * - 若 body 含 `::chart-radar|bars|heatmap::{...json...}::` 哨兵，则把 sentinel 替换为 SVG 图表；
 * - 风险 / 复核 / 最终决策章节在 markdown 之外再额外渲染卡片化 HTML；
 * - 其余章节直接走 markdown 轻渲染。
 */
function renderReportSectionHtml(s: { key: string; title: string; body: string }): string {
  let body = s.body;

  // 哨兵替换：解析 -> SVG
  body = body.replace(CHART_SENTINEL_RE, (_match, kind: string, json: string) => {
    try {
      const payload = JSON.parse(json) as unknown;
      if (kind === "radar") return renderRadarSvg(payload);
      if (kind === "bars") return renderBarsSvg(payload);
      if (kind === "heatmap") return renderHeatmapSvg(payload);
    } catch {
      // ignore parse errors
    }
    return '<p class="muted">图表数据无法解析。</p>';
  });

  // 风险 / 复核 / 最终决策：在 markdown 之外再追加卡片化 HTML
  let extraHtml = "";
  if (s.key === "risks") extraHtml = renderRisksHtml(s.body);
  if (s.key === "reviews") extraHtml = renderReviewsHtml(s.body);
  if (s.key === "final-decision") extraHtml = renderFinalDecisionHtml(s.body);

  return `
  <section class="report-section" data-key="${escapeHtml(s.key)}">
    <h2>${escapeHtml(s.title)}</h2>
    ${renderMarkdownLite(body)}
    ${extraHtml}
  </section>`;
}

/**
 * 多方案雷达 SVG：
 *  - 6 维：安全 / 适配 / 经济 / 便利 / 环境 / 综合
 *  - 不同 tone 的方案绘制不同颜色的多边形 + 顶点标签
 */
function renderRadarSvg(payload: unknown): string {
  const data = (payload ?? {}) as {
    schemes?: { tag: string; tone: string; score: { safety: number; suitability: number; economy: number; convenience: number; environment: number; overall: number } }[];
  };
  const schemes = Array.isArray(data.schemes) ? data.schemes : [];
  if (schemes.length === 0) return '<p class="muted">_无可对比方案_</p>';

  const dims: { key: keyof typeof schemes[0]["score"]; label: string }[] = [
    { key: "safety", label: "安全" },
    { key: "suitability", label: "适配" },
    { key: "economy", label: "经济" },
    { key: "convenience", label: "便利" },
    { key: "environment", label: "环境" },
    { key: "overall", label: "综合" },
  ];
  const cx = 220;
  const cy = 220;
  const radius = 160;
  const axisAngle = (i: number): number => (-Math.PI / 2) + (2 * Math.PI * i) / dims.length;
  const pointFor = (score: number, i: number): { x: number; y: number } => {
    const v = Math.max(0, Math.min(100, score));
    const r = (radius * v) / 100;
    const a = axisAngle(i);
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  };

  // 网格 + 刻度
  const rings = [20, 40, 60, 80, 100];
  const ringHtml = rings
    .map((v) => {
      const points = dims
        .map((_, i) => {
          const { x, y } = pointFor(v, i);
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ");
      return `<polygon class="radar-ring" points="${points}" />`;
    })
    .join("");
  const axesHtml = dims
    .map((d, i) => {
      const p = pointFor(100, i);
      const labelOffset = 12;
      const a = axisAngle(i);
      const lx = cx + (radius + labelOffset) * Math.cos(a);
      const ly = cy + (radius + labelOffset) * Math.sin(a);
      return `
        <line class="radar-axis" x1="${cx}" y1="${cy}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" />
        <text class="radar-axis-label" x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" dominant-baseline="middle">${escapeHtml(d.label)}</text>`;
    })
    .join("");

  // 方案多边形
  const colorOfTone = (tone: string): string => {
    if (tone === "primary") return "var(--accent)";
    if (tone === "danger") return "var(--danger)";
    return "#475569";
  };
  const schemePolys = schemes
    .map((s) => {
      const points = dims
        .map((d, i) => {
          const v = s.score[d.key];
          const { x, y } = pointFor(Number(v) || 0, i);
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ");
      return `<polygon class="radar-poly" data-tone="${escapeHtml(s.tone)}" points="${points}" fill="${colorOfTone(s.tone)}" fill-opacity="0.12" stroke="${colorOfTone(s.tone)}" stroke-width="1.6" />`;
    })
    .join("");

  const legend = schemes
    .map((s) => {
      const color = colorOfTone(s.tone);
      const overall = Number(s.score.overall) || 0;
      return `<span class="chart-legend__item"><i style="background:${color}"></i>${escapeHtml(s.tag)} · ${overall.toFixed(0)}</span>`;
    })
    .join("");

  return `
  <figure class="chart-figure">
    <svg class="radar-svg" viewBox="0 0 440 440" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="多方案六维雷达图">
      ${ringHtml}
      ${axesHtml}
      ${schemePolys}
    </svg>
    <figcaption class="chart-legend">${legend}</figcaption>
  </figure>`;
}

/**
 * 参数对比柱状图：
 *  - 行 = 参数 label
 *  - 每行多列柱（每个方案一列）
 *  - 数值取所有方案中最大值的相对长度
 */
function renderBarsSvg(payload: unknown): string {
  const data = (payload ?? {}) as {
    schemes?: { tag: string; tone: string }[];
    rows?: { label: string; unit: string; values: Record<string, number | null> }[];
  };
  const schemes = Array.isArray(data.schemes) ? data.schemes : [];
  const rows = Array.isArray(data.rows) ? data.rows : [];
  if (schemes.length === 0 || rows.length === 0) return '<p class="muted">_无可对比方案_</p>';

  const colorOfTone = (tone: string): string => {
    if (tone === "primary") return "var(--accent)";
    if (tone === "danger") return "var(--danger)";
    return "#475569";
  };

  // 全局最大值用于归一
  const maxVal = rows.reduce((acc, r) => {
    for (const v of Object.values(r.values)) {
      if (typeof v === "number" && v > acc) acc = v;
    }
    return acc;
  }, 0) || 1;

  const rowHtml = rows
    .map((r) => {
      const cells = schemes
        .map((s) => {
          const v = r.values[s.tag];
          if (typeof v !== "number") {
            return `<span class="bar-cell bar-cell--empty" title="${escapeHtml(s.tag)}">—</span>`;
          }
          const pct = Math.max(2, (v / maxVal) * 100);
          return `
            <span class="bar-cell" title="${escapeHtml(s.tag)} · ${v.toFixed(2)} ${escapeHtml(r.unit)}">
              <span class="bar-cell__fill" data-tone="${escapeHtml(s.tone)}" style="width:${pct.toFixed(1)}%; background:${colorOfTone(s.tone)};"></span>
              <span class="bar-cell__label">${escapeHtml(s.tag)}: ${v.toFixed(2)} ${escapeHtml(r.unit)}</span>
            </span>`;
        })
        .join("");
      return `
        <div class="bar-row">
          <div class="bar-row__label" title="${escapeHtml(r.label)} (${escapeHtml(r.unit)})">${escapeHtml(r.label)} <span class="bar-row__unit">${escapeHtml(r.unit)}</span></div>
          <div class="bar-row__cells">${cells}</div>
        </div>`;
    })
    .join("");

  const header = schemes
    .map((s) => `<span class="bars-header__cell" style="color:${colorOfTone(s.tone)}">${escapeHtml(s.tag)}</span>`)
    .join("");

  return `
  <figure class="chart-figure">
    <div class="bars-header">${header}</div>
    <div class="bars-body">${rowHtml}</div>
  </figure>`;
}

/**
 * 敏感性热力图：
 *  - 行 = 参数 axes
 *  - 列 = delta（-3..+3 等）
 *  - 单元格颜色按 |outputDelta| / maxAbs 渲染红 -> 黄 -> 浅
 */
function renderHeatmapSvg(payload: unknown): string {
  const data = (payload ?? {}) as {
    axes?: string[];
    deltas?: number[];
    matrix?: Record<string, Record<number, number>>;
    maxAbs?: number;
  };
  const axes = Array.isArray(data.axes) ? data.axes : [];
  const deltas = Array.isArray(data.deltas) ? data.deltas : [];
  const matrix = (data.matrix ?? {}) as Record<string, Record<number, number>>;
  const maxAbs = typeof data.maxAbs === "number" && data.maxAbs > 0 ? data.maxAbs : 1;
  if (axes.length === 0 || deltas.length === 0) return '<p class="muted">_本次 Run 未生成敏感性分析_</p>';

  // 颜色：响应强度 [0,1] → 浅黄 (#fef9c3) -> 深橙 (#c2410c)
  const colorOfIntensity = (intensity: number, sign: number): string => {
    const t = Math.max(0, Math.min(1, intensity));
    // 线性插值 RGB
    const r = Math.round(254 - (254 - 194) * t);
    const g = Math.round(249 - (249 - 65) * t);
    const b = Math.round(195 - (195 - 12) * t);
    const alpha = sign < 0 ? 0.55 : 1.0;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const headRow = `<tr><th class="heatmap-corner">参数 \\ Δ</th>${deltas
    .map((d) => `<th class="heatmap-head">${d > 0 ? `+${d}` : d}</th>`)
    .join("")}<th class="heatmap-head heatmap-head--max">|Σ|</th></tr>`;

  const rowsHtml = axes
    .map((axis) => {
      let rowAbs = 0;
      const cells = deltas
        .map((d) => {
          const v = matrix[axis]?.[d];
          if (typeof v !== "number") return `<td class="heatmap-cell heatmap-cell--empty">—</td>`;
          const abs = Math.abs(v);
          rowAbs += abs;
          const intensity = abs / maxAbs;
          const color = colorOfIntensity(intensity, Math.sign(v));
          const textColor = intensity > 0.55 ? "#fff" : "#1f2937";
          return `<td class="heatmap-cell" style="background:${color}; color:${textColor};" title="${escapeHtml(axis)} Δ${d > 0 ? `+${d}` : d} → ${v.toFixed(2)}">${v.toFixed(2)}</td>`;
        })
        .join("");
      const rowAvg = (rowAbs / deltas.length).toFixed(2);
      return `<tr><th class="heatmap-row-label">${escapeHtml(axis)}</th>${cells}<td class="heatmap-cell heatmap-cell--rowmax">${rowAvg}</td></tr>`;
    })
    .join("");

  // 列总均值
  let colSum = 0;
  const colAvgRow = `<tr><th class="heatmap-row-label">列均值</th>${deltas
    .map((d) => {
      let sum = 0;
      let n = 0;
      for (const axis of axes) {
        const v = matrix[axis]?.[d];
        if (typeof v === "number") {
          sum += v;
          n += 1;
        }
      }
      const avg = n > 0 ? sum / n : 0;
      colSum += sum;
      return `<td class="heatmap-cell heatmap-cell--colavg">${avg.toFixed(2)}</td>`;
    })
    .join("")}<td class="heatmap-cell heatmap-cell--grand">${(colSum / (axes.length * deltas.length || 1)).toFixed(2)}</td></tr>`;

  return `
  <figure class="chart-figure">
    <table class="heatmap-table" role="table" aria-label="参数敏感性热力图">
      <thead>${headRow}</thead>
      <tbody>${rowsHtml}${colAvgRow}</tbody>
    </table>
    <figcaption class="chart-legend">
      <span class="chart-legend__item"><i style="background:rgba(254,249,195,1)"></i>低响应</span>
      <span class="chart-legend__item"><i style="background:rgba(224,157,103,1)"></i>中响应</span>
      <span class="chart-legend__item"><i style="background:rgba(194,65,12,1)"></i>高响应</span>
      <span class="chart-legend__muted">（响应 = |Δ 综合评分 / 微调幅度| 归一化强度；负值单元降透明度）</span>
    </figcaption>
  </figure>`;
}

/**
 * 风险分级 HTML 卡片（在 markdown 渲染之外追加）
 */
function renderRisksHtml(body: string): string {
  // 复用 markdown 中已有的"### 风险分级统计"表格，不再重复生成。
  // 仅追加一段关于如何阅读本章节的提示卡片。
  if (!/风险分级统计|high/.test(body)) return "";
  const counts = {
    high: (body.match(/### HIGH/g) || []).length,
    medium: (body.match(/### MEDIUM/g) || []).length,
    low: (body.match(/### LOW/g) || []).length,
  };
  return `<aside class="risk-summary">
    <span class="risk-summary__chip risk-summary__chip--high">HIGH × ${counts.high}</span>
    <span class="risk-summary__chip risk-summary__chip--medium">MEDIUM × ${counts.medium}</span>
    <span class="risk-summary__chip risk-summary__chip--low">LOW × ${counts.low}</span>
    <span class="risk-summary__hint">高 / 中风险是后续"最终决策建议"中的失效条件。</span>
  </aside>`;
}

/**
 * 人工重点确认 HTML 卡片
 */
function renderReviewsHtml(body: string): string {
  if (!/重点关注项|审批动态/.test(body)) return "";
  return `<aside class="review-hint">
    <strong>提示：</strong>规划阶段的复核项不进入自动审批；可在 Planner → Knowledge / Approvals 页面查阅 / 处理。
  </aside>`;
}

/**
 * 最终决策 HTML 卡片（突出"决策结论"一行）
 */
function renderFinalDecisionHtml(body: string): string {
  const m = body.match(/### 决策结论\s*\n([\s\S]+?)(?:\n### |\s*$)/);
  if (!m) return "";
  const conclusion = m[1]?.trim() ?? "";
  if (!conclusion) return "";
  return `<aside class="decision-card">
    <header class="decision-card__title">决策结论</header>
    <p>${escapeHtml(conclusion)}</p>
  </aside>`;
}
