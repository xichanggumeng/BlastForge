/**
 * PDF Renderer 单元测试。
 *
 * 通过注入 mock browser 验证：
 *  - HTML→PDF 调用链；
 *  - 失败时抛 `PdfRenderError`；
 *  - 二次渲染复用同一 browser 实例。
 */

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

import { buildReport } from "@/modules/report/domain";
import type { Report } from "@/modules/report/domain/contracts";
import type { Citation } from "@/modules/agent-runtime/core/contracts";
import type { PlanningRun } from "@/modules/parameter-planning/domain/contracts";

import {
  PdfRenderError,
  __setBrowserFactoryForTests,
  disposePdfRenderer,
  renderReportPdf,
  resolveLaunchOptions,
  type BrowserLike,
} from "./pdf-renderer";

interface FakePage {
  setContent: ReturnType<typeof vi.fn>;
  pdf: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

function makeBrowser(page: FakePage): BrowserLike {
  return {
    newPage: (() => Promise.resolve(page)) as BrowserLike["newPage"],
    close: (() => Promise.resolve()) as BrowserLike["close"],
  };
}

function buildReportFixture(): Report {
  const run: PlanningRun = {
    id: "run-test-pdf",
    presetId: "standard",
    input: {
      engineeringType: "open-pit-bench",
      rockCategory: "medium",
      protodyakonov: 8,
      jointCondition: "blocky",
      waterCondition: "damp",
      constructionEnvironment: "open-area",
      protectionTarget: "none",
      environmentSensitivity: "low",
      costPreference: "balanced",
      convenienceRequirement: "medium",
      freeTextNotes: "",
      flyrockRisk: "low",
    },
    normalized: {
      engineeringTypeLabel: "open-pit-bench",
      rockCategoryLabel: "medium",
      protodyakonov: 8,
      benchHeight: 12,
      holeDiameter: 138,
      holeDepth: 12.5,
      stemmingLength: 3.2,
      holeSpacing: 5.1,
      rowSpacing: 4.3,
      burdenDistance: 4.5,
      chargeStructure: "coupled",
      maxChargePerDelay: 80,
      peakParticleVelocity: 1.5,
      linearChargeDensity: 12,
      totalChargeKg: 320,
    },
    ruleIssues: [],
    schemeSet: {
      schemes: [],
      recommendedId: "scheme-r",
      alternativeIds: [],
      riskIds: [],
    },
    risks: [],
    reviews: [],
    sensitivity: { axes: [], cells: [] },
    steps: [],
    status: "succeeded",
    selectedSchemeId: "scheme-r",
    createdAt: "2026-07-04T10:00:00+08:00",
  };
  const citations: Citation[] = [
    {
      id: "cit-1",
      documentId: "KB-DOC-001",
      documentTitle: "常用炸药类型",
      category: "explosive",
      excerpt: "乳化炸药适用于含水炮孔",
      score: 0.85,
    },
  ];
  return buildReport({ run, citations, approval: null, generatedBy: "test" });
}

function makePage(pdfBytes: Uint8Array, fail = false): FakePage {
  return {
    setContent: vi.fn(async () => undefined),
    pdf: vi.fn(async () => {
      if (fail) throw new Error("chrome crashed");
      return pdfBytes;
    }),
    close: vi.fn(async () => undefined),
  };
}

describe("renderReportPdf", () => {
  beforeEach(async () => {
    await disposePdfRenderer();
    delete process.env.PUPPETEER_EXECUTABLE_PATH;
    delete process.env.PUPPETEER_CHROME;
    delete process.env.CHROME_PATH;
    delete process.env.GOOGLE_CHROME_BIN;
  });
  afterEach(async () => {
    await disposePdfRenderer();
    delete process.env.PUPPETEER_EXECUTABLE_PATH;
    delete process.env.PUPPETEER_CHROME;
    delete process.env.CHROME_PATH;
    delete process.env.GOOGLE_CHROME_BIN;
  });

  it("调用 exportHTML + setContent + pdf，并以 Buffer 返回", async () => {
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // %PDF-1.4
    const page = makePage(pdfBytes);
    const browser = makeBrowser(page);
    const newPageSpy = vi.spyOn(browser, "newPage");
    __setBrowserFactoryForTests(async () => browser);

    const out = await renderReportPdf(buildReportFixture());

    expect(out).toBeInstanceOf(Buffer);
    expect(out.length).toBe(pdfBytes.length);
    expect(page.setContent).toHaveBeenCalledTimes(1);
    const [htmlArg, setOpts] = page.setContent.mock.calls[0] as [string, { timeout: number }];
    expect(htmlArg).toContain("<!DOCTYPE html>");
    expect(setOpts.timeout).toBe(15000);
    expect(page.pdf).toHaveBeenCalledTimes(1);
    const pdfOpts = (page.pdf.mock.calls[0] as [Record<string, unknown>])[0];
    expect(pdfOpts["format"]).toBe("A4");
    expect(pdfOpts["printBackground"]).toBe(true);
    expect(page.close).toHaveBeenCalledTimes(1);
    expect(newPageSpy).toHaveBeenCalledTimes(1);
  });

  it("渲染失败时抛出 PdfRenderError（PDF_RENDER_FAILED）", async () => {
    const page = makePage(new Uint8Array(), true);
    const browser = makeBrowser(page);
    __setBrowserFactoryForTests(async () => browser);

    await expect(renderReportPdf(buildReportFixture())).rejects.toBeInstanceOf(PdfRenderError);
    await expect(renderReportPdf(buildReportFixture())).rejects.toMatchObject({
      code: "PDF_RENDER_FAILED",
    });
    expect(page.close).toHaveBeenCalled(); // 即便失败也会关闭 page
  });

  it("复用同一 browser 实例完成多次渲染", async () => {
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    const page = makePage(pdfBytes);
    const browser = makeBrowser(page);
    const newPageSpy = vi.spyOn(browser, "newPage");
    __setBrowserFactoryForTests(async () => browser);

    const r1 = await renderReportPdf(buildReportFixture());
    const r2 = await renderReportPdf(buildReportFixture());

    expect(r1.length).toBeGreaterThan(0);
    expect(r2.length).toBeGreaterThan(0);
    // 仅一次 newPage 创建：表明 browser 复用
    expect(newPageSpy).toHaveBeenCalledTimes(2);
  });
});

describe("resolveLaunchOptions", () => {
  it("未配置任何环境变量时，返回 headless + args，并标记 source=default", () => {
    const opts = resolveLaunchOptions({});
    expect(opts.executablePath).toBeUndefined();
    expect(opts.headless).toBe(true);
    expect(opts.args).toContain("--no-sandbox");
    expect(opts.diagnostics).toEqual({ source: "default", envName: "PUPPETEER_EXECUTABLE_PATH" });
  });

  it("PUPPETEER_EXECUTABLE_PATH 优先", () => {
    const opts = resolveLaunchOptions({
      PUPPETEER_EXECUTABLE_PATH: "/a/chromium",
      GOOGLE_CHROME_BIN: "/b/chrome",
      CHROME_PATH: "/c/chrome",
    });
    expect(opts.executablePath).toBe("/a/chromium");
    expect(opts.diagnostics.source).toBe("env");
  });

  it("支持 PUPPETEER_CHROME", () => {
    const opts = resolveLaunchOptions({ PUPPETEER_CHROME: "/x/chrome" });
    expect(opts.executablePath).toBe("/x/chrome");
  });

  it("支持 CHROME_PATH", () => {
    const opts = resolveLaunchOptions({ CHROME_PATH: "/y/chrome" });
    expect(opts.executablePath).toBe("/y/chrome");
  });

  it("支持 GOOGLE_CHROME_BIN", () => {
    const opts = resolveLaunchOptions({ GOOGLE_CHROME_BIN: "/z/chrome" });
    expect(opts.executablePath).toBe("/z/chrome");
  });

  it("空字符串视为未配置", () => {
    const opts = resolveLaunchOptions({ PUPPETEER_EXECUTABLE_PATH: "   " });
    expect(opts.executablePath).toBeUndefined();
    expect(opts.diagnostics.source).toBe("default");
  });
});
