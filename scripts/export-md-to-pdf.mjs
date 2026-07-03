#!/usr/bin/env node
// 一次性脚本：把 docs/exports/*.md 转成同名 PDF 到 docs/exports.pdf/
// 运行：`npm run export:pdf` 或 `node scripts/export-md-to-pdf.mjs`
//
// 依赖：
// - markdown-it（HTML 渲染）
// - puppeteer（headless Chrome → PDF）

import { mkdir, readdir, rm, readFile, writeFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import MarkdownIt from 'markdown-it';

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, 'docs', 'exports');
const OUT_DIR = path.join(ROOT, 'docs', 'exports.pdf');
const STYLE_PATH = path.join(ROOT, 'bin', 'pdf-style.css');

const PRINT_CSS = `
@page { size: A4; margin: 18mm 14mm; }
* { box-sizing: border-box; }
html, body {
  font-family: "Microsoft YaHei", "Source Han Sans CN", "Noto Sans CJK SC",
               -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 10pt;
  line-height: 1.55;
  color: #111;
  margin: 0;
  padding: 0;
}
h1, h2, h3, h4 {
  font-family: "Microsoft YaHei", "Source Han Sans CN", sans-serif;
  color: #1a1a1a;
  page-break-after: avoid;
}
h1 { font-size: 22pt; margin: 0 0 8mm; border-bottom: 2px solid #222; padding-bottom: 3mm; }
h2 { font-size: 14pt; margin: 8mm 0 3mm; border-bottom: 1px solid #888; padding-bottom: 1.5mm; }
h3 { font-size: 11.5pt; margin: 5mm 0 2mm; }
p { margin: 0 0 3mm; }
ul, ol { margin: 0 0 3mm 5mm; }
code, pre {
  font-family: "JetBrains Mono", "Cascadia Mono", "Consolas", "Menlo", monospace;
  font-size: 8.6pt;
  line-height: 1.45;
}
p code, li code {
  background: #f3f4f6;
  padding: 0 3px;
  border-radius: 2px;
  color: #b91c1c;
}
pre {
  background: #ffffff;
  color: #111111;
  padding: 4mm;
  border: 1px solid #d1d5db;
  border-radius: 3px;
  overflow-wrap: break-word;
  white-space: pre-wrap;
  page-break-inside: auto;
  margin: 0 0 4mm;
}
pre code {
  background: transparent;
  color: inherit;
  padding: 0;
  font-size: inherit;
}
/* 关键字高亮（白底黑字下的微调） */
.sourceCode .kw  { color: #1d4ed8; font-weight: bold; }
.sourceCode .st  { color: #047857; }
.sourceCode .co  { color: #6b7280; font-style: italic; }
.sourceCode .fu  { color: #7c3aed; }
.sourceCode .va  { color: #b45309; }
.sourceCode .cn  { color: #be185d; }
.sourceCode .ot  { color: #374151; }
blockquote {
  border-left: 3px solid #94a3b8;
  margin: 0 0 3mm;
  padding: 1mm 3mm;
  color: #475569;
  background: #f8fafc;
}
hr { border: 0; border-top: 1px dashed #cbd5e1; margin: 5mm 0; }
table { border-collapse: collapse; margin: 0 0 4mm; }
th, td { border: 1px solid #cbd5e1; padding: 1.5mm 2.5mm; }
thead { background: #f1f5f9; }
/* 入口文件块：4 空格缩进的"文件 / 作用 / 代码"伪段落 */
.fb-file    { font-weight: 600; margin-top: 4mm; }
.fb-purpose { color: #475569; margin: 1mm 0 0; font-size: 9.5pt; }
.fb-code-label { color: #475569; margin: 1mm 0 0; font-size: 9pt; }
/* markdown-it 默认会让行首 4 空格渲染成 <pre><code>，这正好用作代码块的视觉 */
img {
  max-width: 100%;
  height: auto;
  page-break-inside: avoid;
}
`;

function detectTool() {
  // 占位：保留扩展位以备后续加入 pandoc 检测等。
  return { pandoc: false, wkhtmltopdf: false };
}

async function ensureStyle() {
  await mkdir(path.dirname(STYLE_PATH), { recursive: true });
  if (!existsSync(STYLE_PATH)) {
    await writeFile(STYLE_PATH, PRINT_CSS, 'utf8');
  }
  return STYLE_PATH;
}

async function listMdFiles(dir) {
  const names = await readdir(dir);
  return names.filter((n) => n.endsWith('.md')).sort();
}

// 把"    文件：…" / "    作用：…" / "    代码：" 这种带 4 空格缩进的行
// 转成 <div class="fb-*"> 方便 CSS 控制。
function decorateIndentedLabels(html) {
  return html
    .replace(/<p>\s{4}文件：/g, '<p class="fb-file">文件：')
    .replace(/<p>\s{4}作用：/g, '<p class="fb-purpose">作用：')
    .replace(/<p>\s{4}代码：<\/p>/g, '<p class="fb-code-label">代码：</p>');
}

function mdToHtml(markdown, cssText, rootDir) {
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    breaks: false,
    highlight: (str, lang) => {
      const cls = lang ? ' class="language-' + lang + '"' : '';
      const esc = str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return '<pre><code' + cls + '>' + esc + '\n</code></pre>';
    },
  });
  const body = md.render(markdown);

  // 把 ./public/、./bin/ 这类相对路径改写为绝对 file:// URL，
  // 避免 Puppeteer + file:// 协议下"基准目录不固定"导致图片丢失。
  const publicAbs = path.resolve(rootDir, 'public').replace(/\\/g, '/');
  const rewrittenBody = body
    .replace(/src="\.\/public\//g, `src="file:///${publicAbs}/`)
    .replace(/src="\.\.\/\.\.\/public\//g, `src="file:///${publicAbs}/`)
    .replace(/src="public\//g, `src="file:///${publicAbs}/`);

  const html =
    '<!doctype html>\n<html lang="zh-CN"><head><meta charset="utf-8">' +
    '<title>code-export</title>' +
    '<style>' + cssText + '</style>' +
    '</head><body>' + decorateIndentedLabels(rewrittenBody) + '</body></html>';
  return html;
}

async function main() {
  const log = (msg) => console.log('[export-pdf] ' + msg);
  detectTool();

  if (!existsSync(SRC_DIR)) {
    throw new Error(SRC_DIR + ' 不存在，请先运行 `npm run export:code` 生成 Markdown。');
  }
  const cssPath = await ensureStyle();
  const css = await readFile(cssPath, 'utf8');

  await mkdir(OUT_DIR, { recursive: true });
  const old = await readdir(OUT_DIR).catch(() => []);
  for (const name of old) {
    if (name.endsWith('.pdf')) await rm(path.join(OUT_DIR, name), { force: true });
  }

  const inputs = await listMdFiles(SRC_DIR);
  if (inputs.length === 0) throw new Error(SRC_DIR + ' 下没有任何 .md 文件。');
  log('准备转换 ' + inputs.length + ' 份文档…');

  // puppeteer 动态导入：避免在未安装时硬依赖失败
  let puppeteer;
  try {
    puppeteer = (await import('puppeteer')).default;
  } catch {
    throw new Error('未找到 puppeteer，请先 `npm install puppeteer`。');
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--font-render-hinting=none',
      // 允许 file:// 协议加载其他本地文件（图片、CSS 等），
      // 否则 Export PDF 时相对路径图片会被 Chromium 拦截为 "Not allowed to load local resource"
      '--allow-file-access-from-files',
    ],
  });
  let ok = 0;
  let failed = 0;
  try {
    for (const name of inputs) {
      const inputMd = path.join(SRC_DIR, name);
      const outputPdf = path.join(OUT_DIR, name.replace(/\.md$/i, '.pdf'));
      try {
        const md = await readFile(inputMd, 'utf8');
        const html = mdToHtml(md, css, ROOT);
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60000 });
        await page.pdf({
          path: outputPdf,
          format: 'A4',
          printBackground: true,
          margin: { top: '18mm', bottom: '18mm', left: '14mm', right: '14mm' },
          preferCSSPageSize: true,
        });
        await page.close();
        const sz = statSync(outputPdf).size;
        log('  ✓ ' + name + ' → ' + path.basename(outputPdf) + ' (' + sz + ' bytes)');
        ok++;
      } catch (err) {
        console.error('  ✗ ' + name + ' 失败：' + err.message);
        failed++;
      }
    }
  } finally {
    await browser.close();
  }
  log('完成：' + ok + ' 成功 / ' + failed + ' 失败 / 共 ' + inputs.length + ' 份。');
  log('输出目录：' + path.relative(ROOT, OUT_DIR) + '/');
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});