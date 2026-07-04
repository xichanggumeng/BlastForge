import "server-only";

/**
 * Report PDF Renderer —— 服务端 Chromium 渲染。
 *
 * 依赖：`puppeteer-core`（不带 Chromium 二进制）+ 服务器自带的 Chromium / Chrome / Edge。
 *
 * 服务器端启用 puppeteer 的步骤：
 *  1. 在服务器上安装一份 Chromium / Chrome / Edge（任意一种）：
 *       - Linux: `apt-get install -y chromium`，或 `apt-get install -y google-chrome-stable`
 *       - Windows / macOS: 直接装 Chrome / Edge，让浏览器自己写 PATH；
 *  2. 设置 `PUPPETEER_EXECUTABLE_PATH`：
 *       - Linux: `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`
 *       - 若不便打包浏览器进 `.next`，让运维通过环境变量喂二进制路径；
 *  3. 也可保留 `PUPPETEER_SKIP_DOWNLOAD=true` 与 `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true`，
 *     告诉 npm / yarn 不要下载 Chromium；
 *  4. 完全缺失 puppeteer / Chrome 时，PDF 接口会返回 502 + 明确报错，
 *     前端可降级到 HTML 导出 + 浏览器「另存为 PDF」。
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

/**
 * 公开的 launch 选项解析（便于测试）。
 * 输入：环境变量键值；输出：launch 时实际会用的选项 + 诊断信息。
 */
export interface ResolvedLaunchOptions {
  executablePath?: string;
  args: string[];
  headless: true;
  diagnostics: {
    source: "env" | "default" | "none";
    envName: string;
  };
}

/** 默认 launch 参数，集中一处方便调整。 */
export const LAUNCH_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--font-render-hinting=none",
];

/**
 * 决定启动 Chromium 所需的 launch 选项：
 *  - 优先级 PUPPETEER_EXECUTABLE_PATH（推荐运维配置）；
 *  - 退回到 PUPPETEER_CHROME / CHROME_PATH 等常见别名；
 *  - 都不存在时 launch() 会走 puppeteer-core 默认，缺二进制则抛错。
 *
 * 入参类型用 `Record<string, string | undefined>` 而非 `NodeJS.ProcessEnv`，
 * 方便测试传入纯对象；环境对象本身兼容这个类型。
 */
export function resolveLaunchOptions(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): ResolvedLaunchOptions {
  const explicit =
    env.PUPPETEER_EXECUTABLE_PATH ||
    env.PUPPETEER_CHROME ||
    env.CHROME_PATH ||
    env.GOOGLE_CHROME_BIN;

  if (explicit && explicit.trim() !== "") {
    return {
      executablePath: explicit,
      args: LAUNCH_ARGS.slice(),
      headless: true,
      diagnostics: { source: "env", envName: "PUPPETEER_EXECUTABLE_PATH" },
    };
  }
  return {
    args: LAUNCH_ARGS.slice(),
    headless: true,
    diagnostics: { source: "default", envName: "PUPPETEER_EXECUTABLE_PATH" },
  };
}

async function loadBrowser(): Promise<BrowserLike> {
  // 动态 import puppeteer-core：缺包时给出一个明确的 PdfRenderError，避免启动期硬失败。
  // 注意：必须用字符串模板才能让 webpack / turbopack 不要在打包阶段尝试解析。
  let puppeteerCore: {
    launch(opts: Record<string, unknown>): Promise<BrowserLike>;
  };
  try {
    const mod = (await import("puppeteer-core")) as unknown;
    const lib = (mod as { default?: unknown }).default ?? mod;
    puppeteerCore = lib as { launch(opts: Record<string, unknown>): Promise<BrowserLike> };
  } catch (cause) {
    throw new PdfRenderError(
      "未找到 puppeteer-core。请在服务器上 `npm install puppeteer-core`（不下载 Chrome），" +
        "并将浏览器二进制路径写入 `PUPPETEER_EXECUTABLE_PATH`。" +
        "或保留浏览器「另存为 PDF」。",
      cause,
    );
  }

  const opts = resolveLaunchOptions();
  try {
    const launchOpts: Record<string, unknown> = {
      headless: true,
      args: opts.args,
    };
    if (opts.executablePath) launchOpts.executablePath = opts.executablePath;
    const browser = await puppeteerCore.launch(launchOpts);
    return browser;
  } catch (cause) {
    throw new PdfRenderError(
      opts.executablePath
        ? `启动 Chromium 失败（PUPPETEER_EXECUTABLE_PATH=${opts.executablePath}）。请确认路径与可执行权限。`
        : "启动 Chromium 失败。当前未设置 PUPPETEER_EXECUTABLE_PATH，请导出服务器上 chromium / chrome / edge 的绝对路径。",
      cause,
    );
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
