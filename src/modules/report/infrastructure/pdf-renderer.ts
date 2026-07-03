import "server-only";

/**
 * Report PDF Renderer —— 服务端 puppeteer 渲染。
 *
 * 设计要点：
 *  - 单例 puppeteer browser，避免每次渲染都冷启动 Chromium；
 *  - 复用现有 `exportHTML()` 作为 HTML 源，不引入第二套模板；
 *  - 失败抛出带 `code: 'PDF_RENDER_FAILED'` 的 Error，便于 Route Handler 转 502；
 *  - Next.js Route Handler 默认 30s 空闲即关进程，浏览器实例会随之回收，零状态泄漏。
 */

import { exportHTML } from "@/modules/report/domain/exporters";
import type { Report } from "@/modules/report/domain/contracts";

export class PdfRenderError extends Error {
  readonly code: "PDF_RENDER_FAILED";
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "PdfRenderError";
    this.code = "PDF_RENDER_FAILED";
  }
}

interface BrowserLike {
  newPage(): Promise<PageLike>;
  close(): Promise<void>;
}

interface PageLike {
  setContent(html: string, options: { waitUntil: string; timeout: number }): Promise<void>;
  pdf(options: Record<string, unknown>): Promise<Uint8Array>;
  close(): Promise<void>;
}

export type { BrowserLike, PageLike };

let browserPromise: Promise<BrowserLike> | null = null;

async function loadBrowser(): Promise<BrowserLike> {
  // 动态 import puppeteer：
  //  - 缺包时给出一个明确的 PdfRenderError（Route Handler 可降级到 HTML）；
  //  - 启动延迟到第一次实际渲染。
  let puppeteer: { launch(opts: Record<string, unknown>): Promise<BrowserLike> };
  try {
    const mod: { default?: unknown } = await import("puppeteer");
    puppeteer = (mod.default ?? mod) as { launch(opts: Record<string, unknown>): Promise<BrowserLike> };
  } catch (cause) {
    throw new PdfRenderError(
      "未找到 puppeteer，请先 npm install puppeteer；或保留浏览器「另存为 PDF」。",
      cause,
    );
  }

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--font-render-hinting=none",
      ],
    });
    return browser;
  } catch (cause) {
    throw new PdfRenderError("启动 Chromium 失败。", cause);
  }
}

function getBrowser(): Promise<BrowserLike> {
  if (!browserPromise) {
    browserPromise = loadBrowser();
  }
  return browserPromise;
}

export async function renderReportPdf(report: Report): Promise<Buffer> {
  const browser = await getBrowser();
  const html = exportHTML(report);
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 15000 });
    const bytes = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "14mm", bottom: "14mm", left: "14mm", right: "14mm" },
    });
    return Buffer.from(bytes);
  } catch (cause) {
    throw new PdfRenderError(
      `PDF 渲染失败：${cause instanceof Error ? cause.message : String(cause)}`,
      cause,
    );
  } finally {
    await page.close().catch(() => undefined);
  }
}

/** 仅供测试 / 优雅停机使用；下次渲染会重新拉起浏览器。 */
export async function disposePdfRenderer(): Promise<void> {
  if (!browserPromise) return;
  try {
    const b = await browserPromise;
    await b.close();
  } catch {
    // 忽略：测试 reset 阶段可能 browser 已关闭
  } finally {
    browserPromise = null;
  }
}

/** 测试用：注入自定义 browser 工厂以避免真实启动 Chromium。 */
export function __setBrowserFactoryForTests(factory: () => Promise<BrowserLike> | null): void {
  browserPromise = factory();
}
