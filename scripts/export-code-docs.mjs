#!/usr/bin/env node
// 一次性脚本：把仓库内符合规则的代码文件导出为 Markdown 到 docs/exports/
// 运行：`npm run export:code` 或 `node scripts/export-code-docs.mjs`

import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'docs', 'exports');

const EXT_ALLOW = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.css', '.scss', '.sass',
  '.json', '.yml', '.yaml',
]);

const FORCE_INCLUDE_FILES = new Set(['.env', '.env.example']);
const EXCLUDE_TOP_DIRS = new Set(['docs', 'public']);
const EXCLUDE_NAMES = new Set(['AGENTS.md', 'README.md']);
const EXCLUDE_BASENAMES = new Set(['package-lock.json']);

// 仅遮蔽明显是高熵字符串的敏感字段（KEY / SECRET / TOKEN / PASSWORD）。
// NEXT_PUBLIC_ 前缀的变量名通常可公开，遮蔽策略只针对服务端变量。
const SECRET_FIELD_RE = /^(\s*(?:[A-Z][A-Z0-9_]*)(?:_KEY|_SECRET|_TOKEN|_PASSWORD|_APIKEY)\s*=\s*).+$/;
const SECRET_KEEP_NEXT_PUBLIC = false;

function getExt(file) {
  const i = file.lastIndexOf('.');
  if (i <= 0) return '';
  return file.slice(i).toLowerCase();
}

function isInExcludedTopDir(file) {
  for (const top of EXCLUDE_TOP_DIRS) {
    if (file === top || file.startsWith(top + '/')) return true;
  }
  return false;
}

function shouldInclude(file) {
  const base = path.basename(file);
  if (EXCLUDE_NAMES.has(base)) return false;
  if (EXCLUDE_BASENAMES.has(base)) return false;
  if (isInExcludedTopDir(file)) return false;
  if (FORCE_INCLUDE_FILES.has(base)) return true;
  return EXT_ALLOW.has(getExt(file));
}

function listGitFiles() {
  let buf;
  try {
    buf = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT });
  } catch (err) {
    throw new Error('git ls-files 执行失败：' + err.message);
  }
  return buf.toString('utf8').split('\0').filter(Boolean);
}

function listRootEnv() {
  const out = [];
  for (const name of FORCE_INCLUDE_FILES) {
    const p = path.join(ROOT, name);
    if (existsSync(p) && statSync(p).isFile()) out.push(name);
  }
  return out;
}

function groupByParent(files) {
  const groups = new Map();
  for (const f of files) {
    const parent = path.dirname(f);
    if (!groups.has(parent)) groups.set(parent, []);
    groups.get(parent).push(f);
  }
  return groups;
}

function toMdName(dir) {
  if (dir === '.' || dir === '') return 'main.md';
  return dir.split('/').join('.') + '.md';
}

function maskSecrets(content) {
  return content.split(/\r?\n/).map((line) => {
    if (!SECRET_KEEP_NEXT_PUBLIC && /^\s*NEXT_PUBLIC_/i.test(line)) return line;
    return line.replace(SECRET_FIELD_RE, '$1<REDACTED — 建议立即轮换>');
  }).join('\n');
}

function langForFile(file) {
  if (file === '.env' || file === '.env.example') return 'dotenv';
  const ext = getExt(file);
  const map = {
    '.ts': 'ts', '.tsx': 'tsx',
    '.js': 'js', '.jsx': 'jsx',
    '.mjs': 'js', '.cjs': 'js',
    '.css': 'css', '.scss': 'scss', '.sass': 'sass',
    '.json': 'json', '.yml': 'yaml', '.yaml': 'yaml',
  };
  return map[ext] || '';
}

const DIR_PURPOSE = {
  '.': '项目根（构建 / Lint / TypeScript / Tailwind / 环境变量 / 测试配置）',
  'scripts': '仓库脚本（一次性导出器）',
  'vitest.shims': 'Vitest shim（server-only 兼容）',
  'src': '应用源代码（App Router + 模块化架构）',
  'src/app': 'Next.js App Router 入口（页面 / API / 布局 / 加载 / 错误边界）',
  'src/app/(workspace)': 'Workspace 路由组（侧栏 / Navbar）',
  'src/app/(workspace)/agents': 'Agent 工作台页面',
  'src/app/(workspace)/approvals': '人工复核中心页面',
  'src/app/(workspace)/dashboard': '智能驾驶舱页面',
  'src/app/(workspace)/knowledge': '知识库页面',
  'src/app/(workspace)/planner': '参数规划工作台页面',
  'src/app/(workspace)/reports': '报告中心页面',
  'src/app/(workspace)/workflow': 'Workflow 可视化页面',
  'src/app/api': 'Route Handlers（API 端点）',
  'src/app/api/agent': 'Agent API 集合',
  'src/app/api/agent/approvals': '人工复核状态变更',
  'src/app/api/agent/runs': 'Agent Run 列表 / 详情 / 转换',
  'src/app/api/agent/runs/[id]': 'Agent Run 详情 / 转换',
  'src/app/api/agent/runs/[id]/convert': 'Run → PlanningRun 转换',
  'src/app/api/agent/runs/stream': 'SSE Workflow 流式接口',
  'src/app/api/knowledge': '知识库 / RAG 检索 API',
  'src/app/api/knowledge/retrieve': 'RAG 检索端点',
  'src/app/api/reports': '报告生成 / 列表 / 导出',
  'src/components': 'React 组件（UI / 业务 / 布局 / 反馈）',
  'src/components/citations': '引用面板（CitationPanel）',
  'src/components/dashboard': '驾驶舱组件',
  'src/components/dashboard/charts': '驾驶舱图表（ECharts）',
  'src/components/feedback': '通用反馈（Badge / Empty / Loading / Error / Metric / PageHeader / SectionHeader / StatusBadge / RiskBadge / DemoModeBadge）',
  'src/components/human-review': '人工复核 UI（ApprovalBoard）',
  'src/components/knowledge': '知识库 UI（Retrieval Studio）',
  'src/components/layout': '应用 Shell（Navbar / Sidebar / MobileNav / ThemeToggle / WorkspacePage / ModulePreviewCard）',
  'src/components/motion': '动效基础（CountUp / RevealOnScroll）',
  'src/components/planner': '参数规划 UI（Workbench / Form / Charts / Timeline / Detail Panel / Execution Hook）',
  'src/components/presentation': '演示模式（Shell / Bar / Toggle）',
  'src/components/reports': '报告 UI（List / Generate Button）',
  'src/components/showcase': '品牌首页（Hero / Metrics / Flow / Capabilities / AgentPool / AgentNetwork / Topology / Architecture / Safety / CTA / Footer / Brand）',
  'src/components/system': '系统级 Provider（ThemeProvider / ThemeScript）',
  'src/components/ui': '通用 UI 基础组件（Button / Card / Badge / Surface / Skeleton / Progress / Separator / Textarea）',
  'src/components/workflow': 'Workflow 可视化（React Flow）',
  'src/config': '应用配置（brand / nav / env-public）',
  'src/lib': '通用工具（cn / env / format / motion / chart-theme）',
  'src/modules': '业务模块（领域 + 基础设施）',
  'src/modules/agent-runtime': 'Agent Runtime（Orchestrator / Agent / Tool / Workflow / Replay / Provider）',
  'src/modules/agent-runtime/core': 'Agent Runtime 核心（Orchestrator / Supervisor / Registry / Engine / Trace / Replay / EventBus）',
  'src/modules/agent-runtime/server': 'Agent Runtime 服务端（Provider Adapter / Server Config）',
  'src/modules/human-review': '人工复核模块',
  'src/modules/human-review/domain': '人工复核（State Machine + 历史）',
  'src/modules/knowledge': '知识库模块（领域 + 基础设施）',
  'src/modules/knowledge/domain': '知识库领域（RAG Pipeline + Seed）',
  'src/modules/knowledge/infrastructure': '知识库基础设施（In-Memory Repository）',
  'src/modules/parameter-planning': '参数规划模块（领域 + 基础设施）',
  'src/modules/parameter-planning/domain': '参数规划领域（Planner 纯函数 / Zod 契约 / Presets）',
  'src/modules/parameter-planning/infrastructure': '参数规划基础设施（Repository / Schema / Demo Repository）',
  'src/modules/report': '报告模块',
  'src/modules/report/domain': '报告组装（Builder + Exporter MD/JSON/HTML）',
  'src/modules/report/infrastructure': '报告基础设施（In-Memory Repository）',
  'src/modules/safety-review': '安全复核模块',
  'src/modules/safety-review/domain': '安全复核（确定性规则 Checker）',
  'src/server': '服务端（Demo 数据）',
  'src/server/demo': 'Demo 种子数据（Dashboard / Loaders / Seed / Workflow Replays）',
  'src/stores': '客户端 Zustand Store（Planner / Presentation）',
  'src/types': '全局 TypeScript 类型（Dashboard / Demo / Nav / UI）',
};

function dirPurpose(dir) {
  if (DIR_PURPOSE[dir]) return DIR_PURPOSE[dir];
  const segs = dir.split('/');
  return segs[segs.length - 1] + ' 目录';
}

const FILE_PURPOSE_OVERRIDES = {
  // planner
  'planner-store.ts': '规划工作区状态 (Zustand)',
  'presentation-store.ts': '演示模式状态 (Zustand)',
  'use-agent-workflow.ts': 'Planner → Agent Workflow Hook',
  'use-planning-execution.ts': '参数规划执行 Hook',
  'planner-workbench.tsx': '参数规划工作台主组件',
  'engineering-scenario-form.tsx': '工程条件录入表单 (RHF + Zod)',
  'form-fields.ts': '规划表单字段定义',
  'planner-chart-tabs.tsx': '规划图表 Tab 容器',
  'planning-step-timeline.tsx': '规划 6 步 Timeline',
  'scheme-bar-chart.tsx': '方案评分柱状图',
  'scheme-comparison-list.tsx': '方案对比列表',
  'scheme-detail-panel.tsx': '方案详情 / 引用面板',
  'scheme-radar-chart.tsx': '方案雷达图',
  'sensitivity-heatmap-chart.tsx': '参数敏感性热力图',
  'charts.tsx': '规划图表集合',
  // dashboard
  'citation-panel.tsx': '引用面板 (Citation)',
  'dashboard-charts.tsx': '驾驶舱图表集合',
  'agent-stage-chart.tsx': 'Agent 阶段分布图',
  'chart-skeleton.tsx': '图表 Skeleton',
  'risk-distribution-chart.tsx': '风险等级分布图',
  'task-trend-chart.tsx': '任务趋势图',
  '__types.ts': '图表领域类型',
  'dashboard-agent-activity.tsx': 'Agent 池活跃状态',
  'dashboard-current-project.tsx': '当前项目卡',
  'dashboard-knowledge-strip.tsx': '知识引用网格',
  'dashboard-pending-review.tsx': '待人工复核清单',
  'dashboard-recent-reports.tsx': '最近报告列表',
  'dashboard-recent-tasks.tsx': '最近 Run 时间线',
  'dashboard-risk-alerts.tsx': '风险提醒列表',
  // feedback
  'demo-mode-badge.tsx': '回放模式徽章',
  'empty-state.tsx': '空状态组件',
  'error-state.tsx': '错误状态组件',
  'loading-state.tsx': '加载状态组件',
  'metric-card.tsx': '指标卡',
  'page-header.tsx': '页面头部',
  'risk-badge.tsx': '风险徽章',
  'section-header.tsx': '区块头部',
  'status-badge.tsx': '状态徽章',
  // layout
  'app-shell.tsx': '应用 Shell (Navbar + Sidebar)',
  'mobile-nav.tsx': '移动端导航 (Drawer + BottomNav)',
  'module-preview-card.tsx': '模块预览卡',
  'navbar.tsx': '顶部导航',
  'sidebar.tsx': '桌面侧栏',
  'sidebar-context.tsx': '侧栏折叠状态 (Context)',
  'theme-toggle.tsx': '主题切换',
  'workspace-page.tsx': '工作区页面布局',
  // presentation / workflow / reports / human-review / knowledge
  'presentation-shell.tsx': '演示模式 Shell',
  'presentation-bar.tsx': '演示脚本条',
  'presentation-toggle.tsx': '演示模式入口按钮',
  'workflow-flow.tsx': 'Workflow React Flow 视图',
  'workflow-viewer-client.tsx': 'Workflow 客户端查看器',
  'knowledge-retrieval-studio.tsx': '知识库检索工作台',
  'approval-board.tsx': '人工复核面板',
  'report-list.tsx': '报告列表',
  'generate-report-button.tsx': '生成报告按钮',
  // showcase
  'showcase-agent-network.tsx': '首页 Agent 协作网络 SVG',
  'showcase-agent-pool.tsx': '首页 Agent 池',
  'showcase-agent-topology.ts': '首页 Agent 拓扑数据',
  'showcase-architecture.tsx': '首页架构区',
  'showcase-capabilities.tsx': '首页能力分布',
  'showcase-cta.tsx': '首页 CTA 区',
  'showcase-flow.tsx': '首页流程图',
  'showcase-footer.tsx': '首页页脚',
  'showcase-hero.tsx': '首页 Hero',
  'showcase-metrics.tsx': '首页指标条',
  'showcase-safety.tsx': '首页安全区',
  'brand-mark.tsx': '品牌标识',
  // motion / system
  'count-up.tsx': '数字递增动画',
  'reveal-on-scroll.tsx': '滚动进入动画',
  'theme-provider.tsx': '主题 Provider',
  'theme-script.tsx': 'SSR 主题脚本',
  // ui
  'badge.tsx': '基础 Badge',
  'button.tsx': '基础 Button',
  'card.tsx': '基础 Card',
  'progress.tsx': 'Progress',
  'separator.tsx': 'Separator',
  'skeleton.tsx': 'Skeleton',
  'surface.tsx': 'Surface (容器)',
  'textarea.tsx': '基础 Textarea',
  // app root
  'globals.css': '全局样式 (Tailwind v4)',
  'page.tsx': '页面入口 (Next.js App Router)',
  'layout.tsx': 'Layout',
  'loading.tsx': '全局 Loading',
  'not-found.tsx': '全局 404',
  'error.tsx': '全局 Error 边界',
  // infra configs
  'package.json': 'npm 包元数据 + 脚本',
  'tsconfig.json': 'TypeScript 配置（paths / strict）',
  'eslint.config.mjs': 'ESLint 配置 (Next.js core-web-vitals + ts)',
  'next.config.ts': 'Next.js 配置（启用 React Compiler）',
  'postcss.config.mjs': 'PostCSS 配置 (Tailwind v4)',
  'vitest.config.ts': 'Vitest 配置（jsdom + alias）',
  'vitest.setup.ts': 'Vitest 全局 setup',
  // server-only shim
  'server-only.ts': 'server-only 在测试环境下的占位实现',
  // misc env files
  '.env': '本地环境变量（敏感字段已 REDACT）',
  '.env.example': '环境变量模板',
};

function filePurpose(file) {
  const base = path.basename(file);
  const ext = getExt(base);
  if (base.endsWith('.test.ts') || base.endsWith('.test.tsx')) {
    const stem = base.replace(/\.test\.[jt]sx?$/, '');
    return `[${stem}] 单元测试`;
  }
  if (FILE_PURPOSE_OVERRIDES[base]) return FILE_PURPOSE_OVERRIDES[base];
  if (/-store\.[jt]sx?$/.test(base)) return 'Zustand 客户端状态';
  if (/^use-.*\.[jt]sx?$/.test(base)) return 'React Hook';
  if (/\.config\.[mc]?[jt]sx?$/.test(base)) return '配置文件';
  if (base === '.env' || base === '.env.example') return '环境变量 (本地配置 / 模板)';
  if (base === 'page.tsx') return '页面入口 (Next.js App Router)';
  if (base === 'layout.tsx') return 'Layout (Next.js App Router)';
  if (base === 'route.ts') return 'Route Handler (API)';
  if (base === 'route.tsx') return 'Route Handler (API, React)';
  if (base === 'index.ts' || base === 'index.tsx') return '桶导出 (Barrel)';
  if (base === 'error.tsx') return 'Error 边界';
  if (base === 'loading.tsx') return 'Loading 占位';
  if (base === 'not-found.tsx') return 'Not Found 占位';
  if (ext === '.css') return '样式定义';
  if (ext === '.scss' || ext === '.sass') return '样式 (预处理器)';
  if (ext === '.json') return '数据 / 配置文件';
  if (ext === '.yml' || ext === '.yaml') return 'YAML 配置';
  if (ext === '.d.ts') return '类型声明';
  return '业务模块';
}

function buildFileBlock(file) {
  return `    文件：${file}\n    作用：${filePurpose(file)}\n    代码：\n`;
}

async function readText(file) {
  return await readFile(path.join(ROOT, file), 'utf8');
}

function prepareContent(file, raw) {
  if (file === '.env' || file === '.env.example') return maskSecrets(raw);
  return raw;
}

async function clearOutDir() {
  await mkdir(OUT_DIR, { recursive: true });
  const entries = await readdir(OUT_DIR);
  for (const e of entries) {
    if (e.endsWith('.md')) {
      await unlink(path.join(OUT_DIR, e));
    }
  }
}

function buildFileMd(dir, files) {
  const sorted = [...files].sort();
  const lines = [];
  lines.push(`路径：${dir === '.' ? './' : dir + '/'}`);
  lines.push(`作用：${dirPurpose(dir)}`);
  lines.push('代码文件：');
  for (const f of sorted) {
    lines.push(buildFileBlock(f));
  }
  return { header: lines.join('\n') + '\n', sorted };
}

// 将文件中可能存在的 ``` 行替换为 ````（再加一空格），让任何长度的内层 fence 都不影响外层。
// 简化策略：把内层 ``` 都替换为 ````（四反引号）。
function neutralizeFences(content) {
  return content.replace(/```+/g, (m) => m + '`');
}

async function writeFileMd(dir, files) {
  const { header, sorted } = buildFileMd(dir, files);
  const chunks = [header];
  for (const f of sorted) {
    const lang = langForFile(f);
    const raw = await readText(f);
    const prepared = prepareContent(f, raw);
    const content = neutralizeFences(prepared);
    chunks.push('```' + lang + '\n');
    chunks.push(content);
    if (!content.endsWith('\n')) chunks.push('\n');
    chunks.push('```\n');
  }
  await writeFile(path.join(OUT_DIR, toMdName(dir)), chunks.join(''), 'utf8');
}

async function buildTreeMd(allFiles, mdFiles) {
  const sorted = [...allFiles].sort();
  const lines = [];
  lines.push('# 代码导出目录树');
  lines.push('');
  lines.push('> 本文档由 `scripts/export-code-docs.mjs` 自动生成。');
  lines.push('> 范围：所有 git tracked 文件 + 根目录的 `.env` / `.env.example`，按白名单扩展名过滤。');
  lines.push('');
  lines.push('## 排除规则');
  lines.push('');
  lines.push('- 路径以 `docs/` 或 `public/` 开头 → EXCLUDED');
  lines.push('- 文件名 `AGENTS.md` / `README.md` → EXCLUDED');
  lines.push('- `package-lock.json` 等自动生成 → EXCLUDED');
  lines.push('- `.env` 中的 `*_KEY / *_SECRET / *_TOKEN / *_PASSWORD` 字段值已 REDACT');
  lines.push('');
  lines.push('## 被纳入文件清单');
  lines.push('');
  lines.push('```');
  for (const p of sorted) lines.push(p);
  lines.push('```');
  lines.push('');
  lines.push('## 生成的 Markdown 文档');
  lines.push('');
  lines.push('```');
  for (const p of mdFiles) lines.push(p);
  lines.push('```');
  lines.push('');
  return lines.join('\n');
}

async function main() {
  await clearOutDir();
  const gitFiles = listGitFiles();
  const envFiles = listRootEnv();
  const allFiles = [...new Set([...gitFiles, ...envFiles])]
    .filter(shouldInclude)
    .sort();

  const groups = groupByParent(allFiles);
  const mdNames = [];
  for (const [dir, files] of groups) {
    const name = toMdName(dir);
    await writeFileMd(dir, files);
    mdNames.push(name);
  }
  mdNames.sort();

  await writeFile(path.join(OUT_DIR, 'tree.md'), await buildTreeMd(allFiles, mdNames), 'utf8');

  const total = allFiles.length;
  const mds = mdNames.length + 1; // +1 for tree.md
  console.log(`Exported ${total} files into ${mds} markdown documents under ${path.relative(ROOT, OUT_DIR)}/`);
  if (envFiles.includes('.env')) {
    console.log('Note: .env was included with sensitive field values REDACTED.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
