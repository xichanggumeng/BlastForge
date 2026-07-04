#!/usr/bin/env node
/**
 * BlastForge Web —— 服务器端部署包打包工具。
 *
 * 用户场景：
 *   - 本地 `npm run build` 生成 .next；
 *   - 服务器上只有 .next / public / package.json，没有 node_modules；
 *   - PDF 接口需要 puppeteer-core + Chromium 二进制；
 *   - 把 puppeteer 全包（包含上百 MB Chrome）拷过去显然不划算。
 *
 * 本脚本做的事：
 *   1. 读取 package.json 的 `dependencies`，按 useRuntimeDeps 白名单筛选出
 *      真正会被服务端运行时用到的 npm 包（puppeteer-core 及其间接依赖、jsdom 等）；
 *   2. 调用 pnpm/npm 把这些包安装到指定 `output/node_modules`（只 prod，生产跳过 dev）；
 *   3. 拷贝 .next / public / package.json / scripts / 关键 .env.example 到 output；
 *   4. 生成 DEPLOY.md 给出 `PUPPETEER_EXECUTABLE_PATH` 配置提示；
 *   5. 输出最终压缩包路径（可选）。
 *
 * 环境变量：
 *   - DEPLOY_OUTPUT_DIR    输出目录（默认 `.deploy/`）
 *   - PUPPETEER_EXECUTABLE_PATH  Chromium / Chrome 路径，会被写入 DEPLOY.md
 *
 * 用法：
 *   1) 本地先跑 `npm run build`；
 *   2) `node scripts/build-server-deploy.mjs`   ← 生成 `.deploy/`；
 *   3) 把 `.deploy/` 整目录 rsync / scp 到服务器；
 *   4) 服务器执行 `npm ci --omit=dev --omit=optional --prefix /your/app/deploy/.next-runtime`
 *      或直接 `node .next/standalone/server.js`（如果用 standalone 输出）。
 *
 *   简单方案：在服务器上 `cd .deploy && pnpm install --prod --frozen-lockfile=false`。
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, statSync, rmSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), "..");
const OUT_DIR = resolve(ROOT, process.env.DEPLOY_OUTPUT_DIR || ".deploy");

/** 运行时必须被打包进部署产物的 npm 包。修改此处即可增减。 */
const RUNTIME_DEPS = [
  "puppeteer-core",
  "@puppeteer/browsers",
  "chromium-bidi",
  "devtools-protocol",
  "chromium-bidi/lib",
  // 链上其它跟随 puppeteer-core 的轻量依赖按需补充
];

function log(...args) {
  console.log("[deploy-package]", ...args);
}

function rmrf(target) {
  if (existsSync(target)) {
    rmSync(target, { recursive: true, force: true });
  }
}

function copyDir(src, dst) {
  if (!existsSync(dst)) mkdirSync(dst, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const s = join(src, entry.name);
    const d = join(dst, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else copyFileSync(s, d);
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/**
 * 从 package.json 的 dependencies 出发，递归展开所有需要被打包进部署产物的 npm 包。
 * 这里采用 BFS：先加入直接依赖，再从各包的 package.json 拉出 peerDependencies（runtime-only）
 * 与子依赖（如果父依赖是 npm 包）。
 */
function collectRuntimeDeps(rootPkgPath) {
  const root = readJson(rootPkgPath);
  const direct = Object.keys(root.dependencies || {});
  // puppeteer-core 直接进来，puppeteer 是 devDep 不进入运行时
  const allDeps = new Set(direct);
  const queue = [...direct];
  while (queue.length > 0) {
    const name = queue.shift();
    let version = root.dependencies?.[name] ?? root.optionalDependencies?.[name];
    if (!version || !version.startsWith("^") && !version.startsWith("~") && !/^\d/.test(version)) {
      // 跳过来自间接路径（非直接版本号）
      continue;
    }
    const pkgPath = join(ROOT, "node_modules", name, "package.json");
    if (!existsSync(pkgPath)) continue;
    let pkg;
    try {
      pkg = readJson(pkgPath);
    } catch {
      continue;
    }
    for (const dep of Object.keys(pkg.dependencies || {})) {
      if (!allDeps.has(dep)) {
        allDeps.add(dep);
        queue.push(dep);
      }
    }
  }
  return Array.from(allDeps).sort();
}

/**
 * 把 list-of-package-names 用 pnpm 装进 OUT_DIR/node_modules。
 * 失败回落到 npm install --omit=dev。
 */
function installRuntimeDeps(pkgs) {
  const cwd = OUT_DIR;
  log("安装运行时依赖（共", pkgs.length, "个）到", cwd);

  // 优先使用 pnpm —— 与 monorepo 默认工具一致
  let result = spawnSync(
    "pnpm",
    ["add", "--prod", "--ignore-scripts", ...pkgs],
    { cwd, stdio: "inherit", shell: true },
  );
  if (result.status !== 0) {
    log("pnpm 不可用或失败，回落到 npm install...");
    result = spawnSync(
      "npm",
      ["install", "--omit=dev", "--no-audit", "--no-fund", "--ignore-scripts", ...pkgs],
      { cwd, stdio: "inherit", shell: true },
    );
    if (result.status !== 0) {
      throw new Error("无法安装运行时依赖，请手动 pnpm/npm install --prod。");
    }
  }
}

function main() {
  log("目标目录:", OUT_DIR);
  rmrf(OUT_DIR);
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(join(OUT_DIR, "public"), { recursive: true });
  mkdirSync(join(OUT_DIR, "scripts"), { recursive: true });

  // 复制 .next / public / package.json / scripts
  log("复制 .next 目录...");
  if (!existsSync(join(ROOT, ".next"))) {
    throw new Error(".next 不存在，请先运行 `npm run build`。");
  }
  copyDir(join(ROOT, ".next"), join(OUT_DIR, ".next"));

  log("复制 public 目录...");
  copyDir(join(ROOT, "public"), join(OUT_DIR, "public"));

  log("复制 package.json（含 dependencies）...");
  copyFileSync(join(ROOT, "package.json"), join(OUT_DIR, "package.json"));

  // 复制脚本到 deploy/scripts（包含 export-md-to-pdf.mjs 等可选）
  log("复制 scripts...");
  for (const f of readdirSync(join(ROOT, "scripts"))) {
    copyFileSync(join(ROOT, "scripts", f), join(OUT_DIR, "scripts", f));
  }

  // 计算运行时依赖并安装
  log("收集运行时依赖...");
  const deps = collectRuntimeDeps(join(ROOT, "package.json"));
  // 强制把 puppeteer-core 加进去（即使从 dependencies 中漏列也能补）
  for (const must of RUNTIME_DEPS) {
    if (!deps.includes(must)) deps.push(must);
  }
  log("最终运行时依赖:", deps.join(", "));

  installRuntimeDeps(deps);

  // 生成 DEPLOY.md
  const puppeteerBin = process.env.PUPPETEER_EXECUTABLE_PATH || "（请补全）";
  const deployMd = `# BlastForge Demo 服务端部署

## 1. 环境要求

- Node.js >= 20
- 系统已安装 Chromium / Chrome / Edge（任一）；以下给出常见路径：
  - Linux (Debian/Ubuntu): \`apt-get install -y chromium\` 或 \`wget https://dl.google.com/...google-chrome-stable.deb && dpkg -i\`
  - Linux (RHEL/CentOS): \`yum install -y chromium\` 或 \`google-chrome-stable\`
  - macOS: \`brew install --cask chromium\` 或默认 Chrome
  - Windows: 装 Chrome / Edge 任意一个

## 2. PDF 接口要求：浏览器二进制路径

服务端需要在启动时拿到浏览器二进制路径，建议通过环境变量提供：

\`\`\`bash
export PUPPETEER_SKIP_DOWNLOAD=true
export PUPPETEER_EXECUTABLE_PATH=${puppeteerBin}
\`\`\`

> 当前记录的路径：\`${puppeteerBin}\`
> 未设置时，pdf-renderer 会按以下优先级尝试发现浏览器：
>   1. \`PUPPETEER_EXECUTABLE_PATH\`
>   2. \`PUPPETEER_CHROME\`
>   3. \`CHROME_PATH\`
>   4. \`GOOGLE_CHROME_BIN\`
> 都没有时直接返回明确的 PdfRenderError，请联系运维配置。

## 3. 启动

\`\`\`bash
# 安装运行时依赖（首次或 .deploy/node_modules 缺失时执行）
pnpm install --prod --ignore-scripts || npm install --omit=dev --ignore-scripts

# 启动
npm run start
# 或：node node_modules/next/dist/bin/next start -p 3000
\`\`\`

## 4. 验证 PDF 接口

\`\`\`bash
curl 'http://localhost:3000/api/reports?id=<report-id>&format=pdf' -o report.pdf
\`\`\`

正常情况下会得到 \`Content-Type: application/pdf\` 的二进制流。
失败时返回 502 + 明确错误码 \`PDF_RENDER_FAILED\`，错误信息会指出浏览器二进制缺失或路径配置错误。

## 5. 故障排查

- \`未找到 puppeteer-core\`：执行 \`pnpm install --prod --ignore-scripts\`。
- \`启动 Chromium 失败\`：检查 \`PUPPETEER_EXECUTABLE_PATH\` 是否指向有效可执行文件。
  - Linux: \`ls -la $PUPPETEER_EXECUTABLE_PATH\`，并 \`chmod +x\`。
  - Windows: 确认是否带空格，需要双引号或转义。
- 容器内启动报 \"Failed to move to new namespace\"：Docker 默认 --security-opt seccomp=unconfined。
- 字体不显示：\`sudo apt-get install -y fonts-noto-cjk\` 或挂载宿主字体。
`;
  writeFileSync(join(OUT_DIR, "DEPLOY.md"), deployMd, "utf8");
  log("已生成 DEPLOY.md");

  // 输出汇总
  const outSizeMB = (statSync(OUT_DIR).size / 1024 / 1024).toFixed(2);
  log("部署包已生成:", OUT_DIR);
  log("顶层大小（含 node_modules）:", outSizeMB, "MB（详细信息 du -sh .deploy）");
  log("下一步：rsync .deploy/ 到服务器,并按 DEPLOY.md 操作。");
}

main();
