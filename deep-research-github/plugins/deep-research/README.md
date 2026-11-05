# Deep Research

## 中文

需要 Node.js 22 或更高版本。插件已打包，无需 `npm ci`；`npm run build` 可重新构建。

Codex 桌面端：运行 `codex plugin marketplace add <path to marketplace root>`，重启应用，在 Plugins 中选择 “Deep Research (local)” 并安装。

Codex CLI、Claude Code 或通用 MCP：配置命令 `node`，参数为插件内 `dist/server.mjs` 的绝对路径；Claude Code 也可使用 `claude --plugin-dir <插件路径>`。

报告保存在 `Documents/DeepResearch/<runId>/`；可通过 `DEEP_RESEARCH_HOME` 覆盖。工具和限制见下方。

## English

Requires Node.js 22 or newer. The server is bundled; no `npm ci` is needed. Run `npm run build` to rebuild the bundle.

Codex desktop: run `codex plugin marketplace add <path to marketplace root>`, restart the app, open Plugins, choose “Deep Research (local)”, and Install.

Codex CLI, Claude Code, or generic MCP: configure command `node` with the absolute path to `dist/server.mjs` in the plugin as its argument. Claude Code can also use `claude --plugin-dir <plugin path>`.

Reports are saved to `Documents/DeepResearch/<runId>/`; set `DEEP_RESEARCH_HOME` to override the root.

### Tools / 工具

- `plan_save`: save a research plan.
- `source_add`: record a source and its evidence metadata.
- `source_list`: list recorded sources.
- `source_screen`: include or exclude a source with a reason.
- `source_verify`: check identifiers and metadata against Europe PMC.
- `literature_search`: search Europe PMC or chase references and citations.
- `fetch_page`: fetch a public page or PDF, with Europe PMC fallback for blocked PubMed/PMC pages.
- `report_assemble`: validate citations and save the report.

### Limits / 限制

There is no built-in general web search; the workflow uses the host's search. `literature_search` covers Europe PMC only. Fetches time out after 20 seconds, follow at most 5 redirects, and are limited to 10MB; private addresses are refused. Model quality differs from OpenAI's RL-tuned model.
