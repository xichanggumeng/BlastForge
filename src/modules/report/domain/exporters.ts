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

export function exportHTML(report: Report): string {
  const { recommended, alternatives, riskSchemes } = extractSchemesFromSections(report);
  const schemesHtml = renderSchemesSectionForHtml(recommended, alternatives, riskSchemes);

  const sectionsHtml = report.sections
    .filter((s) => s.key !== "schemes" && s.key !== "citations")
    .map(
      (s) => `
  <section class="report-section" data-key="${escapeHtml(s.key)}">
    <h2>${escapeHtml(s.title)}</h2>
    ${renderMarkdownLite(s.body)}
  </section>`,
    )
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
