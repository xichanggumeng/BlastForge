/**
 * 参数规划模块 - Drizzle / PostgreSQL Schema (占位)。
 *
 * 本阶段不实际启用数据库连接，文件用于：
 * - 锁定表结构以便未来会话无痛切换；
 * - 演示 Repository 适配相同接口；
 * - 仅在不连接数据库时通过 README / handoff 引导切换到 demo 仓库。
 *
 * 适配切换点：`database-repository.ts` 留作后续实现。
 */

export const PLANNING_SCHEMA_SQL = `
-- 已设计但不在 Phase 3 / Session 3 中创建的实际表；
-- 保留 SQL 文案便于 PostgreSQL + Drizzle 落地时直接对齐。

-- projects
CREATE TABLE IF NOT EXISTS projects (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  site          TEXT,
  status        TEXT NOT NULL,
  risk          TEXT NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 工程场景（覆盖 18.x 输入字段）
CREATE TABLE IF NOT EXISTS blast_scenarios (
  id                 TEXT PRIMARY KEY,
  project_id         TEXT REFERENCES projects(id) ON DELETE CASCADE,
  preset_id          TEXT,
  engineering_type   TEXT NOT NULL,
  rock_category      TEXT NOT NULL,
  protodyakonov      NUMERIC(4,1) NOT NULL,
  joint_condition    TEXT NOT NULL,
  water_condition    TEXT NOT NULL,
  construction_env   TEXT NOT NULL,
  protection_target  TEXT NOT NULL,
  env_sensitivity    TEXT NOT NULL,
  cost_preference    TEXT NOT NULL,
  convenience_req    TEXT NOT NULL,
  free_text_notes    TEXT,
  -- Demo 模拟参数
  bench_height       NUMERIC(6,2),
  hole_diameter      NUMERIC(6,2),
  hole_depth         NUMERIC(6,2),
  stemming_length    NUMERIC(6,2),
  target_fragment    NUMERIC(6,2),
  peak_ppv           NUMERIC(5,2),
  flyrock_risk       TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 规划运行
CREATE TABLE IF NOT EXISTS planning_runs (
  id            TEXT PRIMARY KEY,
  scenario_id   TEXT NOT NULL REFERENCES blast_scenarios(id) ON DELETE CASCADE,
  status        TEXT NOT NULL,
  blocked_reason TEXT,
  input_json    JSONB NOT NULL,
  normalized_json JSONB NOT NULL,
  rule_issues_json JSONB NOT NULL,
  risks_json    JSONB NOT NULL,
  reviews_json  JSONB NOT NULL,
  sensitivity_json JSONB NOT NULL,
  steps_json    JSONB NOT NULL,
  selected_scheme_id TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);

-- 方案
CREATE TABLE IF NOT EXISTS schemes (
  id            TEXT PRIMARY KEY,
  run_id        TEXT NOT NULL REFERENCES planning_runs(id) ON DELETE CASCADE,
  category      TEXT NOT NULL,
  label         TEXT NOT NULL,
  tag           TEXT NOT NULL,
  applicability TEXT,
  note          TEXT,
  -- Predicted parameters & score 内嵌 JSONB（不属于高频筛选）
  predicted_json JSONB NOT NULL,
  parameters_json JSONB NOT NULL,
  score_json    JSONB NOT NULL,
  risks_json    JSONB NOT NULL
);

-- 方案评分（出于统计需求保留独立表，便于后续排序）
CREATE TABLE IF NOT EXISTS scheme_scores (
  run_id          TEXT NOT NULL REFERENCES planning_runs(id) ON DELETE CASCADE,
  scheme_id       TEXT NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
  safety          NUMERIC(5,2) NOT NULL,
  suitability     NUMERIC(5,2) NOT NULL,
  economy         NUMERIC(5,2) NOT NULL,
  convenience     NUMERIC(5,2) NOT NULL,
  environment     NUMERIC(5,2) NOT NULL,
  overall         NUMERIC(5,2) NOT NULL,
  PRIMARY KEY (run_id, scheme_id)
);
`;

export const PLANNING_SCHEMA_NOTE = `
上述 SQL 仅用于沟通，不在 Session 3 中执行；
实际落库请在 Phase 4 / Session 4 在 \`drizzle.config.ts\` 与 \`@blast/db\` 中实现 Drizzle 适配；
UI 层不感知差异。
`;

export const PLANNING_SCHEMA_INDEXES_SQL = `
CREATE INDEX IF NOT EXISTS idx_planning_runs_scenario ON planning_runs(scenario_id);
CREATE INDEX IF NOT EXISTS idx_schemes_run_category ON schemes(run_id, category);
`;
