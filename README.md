# Deep Research

[中文](#中文) | [English](#english)

---

## 中文

**把 ChatGPT「Deep Research」式的工作流做成一个可移植的插件。** 它让 Codex(桌面端 / CLI)、Claude Code 等 Agent 能够:先规划、再多轮检索文献和网页、筛选并核对来源,最后写出带 `[n]` 引用、经过校验的结构化报告。

### 它做什么

- **规划**:把问题拆成 3–8 个子问题,区分「直接证据」和「间接证据」。
- **检索**:直接查询 Europe PMC(支持按年份过滤、顺着参考文献/被引文献追踪),并配合宿主自带的网页搜索找指南、学会声明、期刊官网。
- **抓取**:读取网页和 PDF;PubMed / PMC 返回 403 或 Cookie / 验证码页面时,自动改走 Europe PMC。
- **记录与筛选**:每个来源记录 PMID/DOI、作者、年份、期刊、研究类型、样本量、干预参数、结局、关键数字、图表编号、是否读过全文;可以把不用的来源标为「排除」并写明理由。
- **核对**:`source_verify` 用 Europe PMC 元数据核对 PMID/DOI 与第一作者、年份、期刊是否一致,拦截张冠李戴。
- **成文**:`report_assemble` 校验每个 `[n]` 都对应已记录的来源、每个纳入的来源都被引用、被排除的来源没有被引用,然后自动附上参考文献、排除来源和检索日志。
- 报告保存到 `文档\DeepResearch\<runId>\`(可用环境变量 `DEEP_RESEARCH_HOME` 修改)。

### 安装前提

- Node.js **22 或更高**(`node -v` 查看)。
- Codex 桌面端或 Codex CLI(见下方)。不需要运行 `npm install`,服务端已打包在 `plugins/deep-research/dist/server.mjs`。

### 在 Codex 桌面端安装(推荐)

1. 下载或克隆本仓库到本机,例如 `C:\Users\你\Documents\deep-research`。
2. 打开终端,把本仓库注册为插件市场(路径换成你自己的):

   ```bash
   codex plugin marketplace add C:\Users\你\Documents\deep-research
   ```

   也可以直接用 GitHub 地址:`codex plugin marketplace add <你的用户名>/<仓库名>`。*(GitHub 地址这种方式作者尚未实测,若失败请用本地路径。)*
3. **完全退出并重新启动 Codex 桌面端。**
4. 打开左侧的 **插件(Plugins)目录**,选择名为 **「Deep Research (local)」** 的市场(分类:Education & Research)。
5. 点击 **Deep Research → 安装(Install)**。
6. 在对话输入框里输入 `@`,选择 **Deep Research**(或直接输入 `$deep-research`),再写你的研究问题即可。

示例提示词:

```
@Deep Research 请就"心脏手术体外循环停机阶段恢复小潮气量通气对肺功能的影响"做文献调研,
用于 25 分钟的科内学术报告。检索 PubMed 和 Europe PMC,找 20–30 篇文献,
区分直接证据与间接证据,列出证据表,并告诉我哪些原文图表值得放进 PPT。
```

### 在 Codex CLI / Claude Code / 其他 MCP 客户端使用

服务端是标准的 stdio MCP 服务器:命令 `node`,参数为 `dist/server.mjs` 的**绝对路径**。

```json
{"mcpServers":{"deep_research":{"command":"node","args":["/绝对路径/plugins/deep-research/dist/server.mjs"]}}}
```

技能(工作流说明)位于 `plugins/deep-research/skills/deep-research/`;只用 MCP 的客户端可参考 `plugins/deep-research/AGENTS.snippet.md`。Claude Code 也可以尝试 `claude --plugin-dir <plugins/deep-research 的绝对路径>`。*(Claude Code 与其他客户端的路径作者没有实测,仅 Codex 桌面端按上述步骤验证过。)*

### 卸载

在 Codex 的插件目录里卸载 Deep Research,然后运行 `codex plugin marketplace remove local-deep-research`(如果你的版本支持),或手动删除 `~/.codex/config.toml` 里的 `[marketplaces.local-deep-research]` 段落。

### 8 个工具

| 工具 | 作用 |
|---|---|
| `plan_save` | 保存问题、子问题和停止条件,返回运行 ID |
| `literature_search` | 查询 Europe PMC;或按 PMID 追踪参考文献 / 被引文献 |
| `fetch_page` | 抓取网页或 PDF;PubMed/PMC 被拦时改走 Europe PMC |
| `source_add` | 记录来源、原文短引和结构化证据字段 |
| `source_list` | 列出来源 |
| `source_screen` | 纳入 / 排除来源并写明理由 |
| `source_verify` | 核对 PMID/DOI 与作者、年份、期刊是否一致 |
| `report_assemble` | 校验引用并保存报告 |

### 安全与隐私

- 插件不收集、不上传任何数据;网络请求只发往 Agent 要求的网址和 Europe PMC(查询内容就是 Agent 选定的检索词)。
- `fetch_page` 拒绝本机和内网地址(localhost、10/8、127/8、169.254/16、172.16/12、192.168/16、100.64/10、IPv6 回环 / ULA / 链路本地),解析 DNS 后再次检查并固定地址,最多 5 次重定向,最大 10MB,超时 20 秒。
- 所有文件只写入 `DeepResearch` 目录。

### 局限(请务必了解)

- **没有内置的通用网页搜索**,依赖宿主 Agent 自带的搜索工具;`literature_search` 目前只覆盖 Europe PMC。
- 输出质量取决于所用模型,与 OpenAI 自家强化学习调优的 Deep Research 模型不同。
- 只读到摘要的来源会被标注「仅摘要」;**报告中的数字和引用仍需你在使用前人工核对**(尤其是用于正式汇报或发表时)。
- 打包文件约 12MB(内含 PDF 解析库)。
- 已在 Windows + Node 22 + Codex 桌面端测试;macOS / Linux 未测试。

### 开发

```bash
cd plugins/deep-research
npm ci
npm test        # 离线单元测试
npm run build   # 重新生成 dist/server.mjs
```

### 许可

MIT,见 [LICENSE](LICENSE)。

---

## English

**A portable "Deep Research" workflow for coding agents.** It lets Codex (desktop/CLI), Claude Code and other MCP clients plan a question, search literature and the web over multiple rounds, screen and verify sources, and write a structured report with validated `[n]` citations.

### What it does

- **Plan** the question into 3–8 sub-questions, separating direct from indirect evidence.
- **Search** Europe PMC directly (year filters, reference and cited-by chasing), alongside the host's own web search for guidelines and journal pages.
- **Fetch** pages and PDFs; when PubMed/PMC answers with 403, a cookie wall or a CAPTCHA, it falls back to Europe PMC automatically.
- **Record and screen** each source with PMID/DOI, authors, year, journal, design, sample size, intervention parameters, outcomes, key numbers, figure/table IDs and whether the full text was read; unused sources are excluded with a reason.
- **Verify** PMID/DOI against first author, year and journal via Europe PMC metadata.
- **Assemble** the report: every `[n]` must match a recorded source, every included source must be cited, excluded sources must not be, then References, Excluded sources and a Search log are appended.
- Reports are saved to `Documents/DeepResearch/<runId>/` (override with `DEEP_RESEARCH_HOME`).

### Requirements

- Node.js **22 or newer** (`node -v`).
- Codex desktop or Codex CLI. No `npm install` is needed; the server is bundled in `plugins/deep-research/dist/server.mjs`.

### Install in Codex desktop (recommended)

1. Download or clone this repository, e.g. to `C:\Users\you\Documents\deep-research`.
2. In a terminal, register the repository as a plugin marketplace (use your own path):

   ```bash
   codex plugin marketplace add C:\Users\you\Documents\deep-research
   ```

   You can also use the GitHub form `codex plugin marketplace add <owner>/<repo>`. *(The GitHub form has not been tested by the author; if it fails, use the local path.)*
3. **Fully quit and restart the Codex desktop app.**
4. Open the **Plugins directory** in the left sidebar and choose the marketplace named **"Deep Research (local)"** (category: Education & Research).
5. Click **Deep Research → Install**.
6. In the composer, type `@` and pick **Deep Research** (or type `$deep-research`), then write your research question.

Example prompt:

```
@Deep Research Review the literature on <your topic> for a 25-minute talk.
Search PubMed and Europe PMC, find 20–30 papers, separate direct from indirect
evidence, give an evidence table, and tell me which original figures are worth showing.
```

### Use with Codex CLI, Claude Code or any MCP client

The server is a standard stdio MCP server: command `node`, argument = the **absolute path** to `dist/server.mjs`.

```json
{"mcpServers":{"deep_research":{"command":"node","args":["/absolute/path/plugins/deep-research/dist/server.mjs"]}}}
```

The workflow skill lives in `plugins/deep-research/skills/deep-research/`; MCP-only clients can use `plugins/deep-research/AGENTS.snippet.md`. Claude Code may also work with `claude --plugin-dir <absolute path to plugins/deep-research>`. *(Only the Codex desktop route above has been verified by the author.)*

### Uninstall

Uninstall Deep Research from the Plugins directory, then run `codex plugin marketplace remove local-deep-research` (if your version supports it) or delete the `[marketplaces.local-deep-research]` section from `~/.codex/config.toml`.

### Tools

| Tool | Purpose |
|---|---|
| `plan_save` | Save the question, sub-questions and stop criteria; returns a run ID |
| `literature_search` | Query Europe PMC, or chase references / citing papers by PMID |
| `fetch_page` | Fetch a page or PDF, with Europe PMC fallback for blocked PubMed/PMC pages |
| `source_add` | Record a source, a verbatim quote and structured evidence fields |
| `source_list` | List recorded sources |
| `source_screen` | Include or exclude a source with a reason |
| `source_verify` | Check PMID/DOI against author, year and journal |
| `report_assemble` | Validate citations and save the report |

### Security and privacy

- The plugin collects and uploads nothing. Network requests go only to URLs the agent asks for and to Europe PMC (the query is whatever search terms the agent chose).
- `fetch_page` refuses localhost and private ranges (10/8, 127/8, 169.254/16, 172.16/12, 192.168/16, 100.64/10, IPv6 loopback/ULA/link-local), checks DNS results and pins the address, follows at most 5 redirects, caps responses at 10MB and times out after 20 seconds.
- Files are written only under the `DeepResearch` folder.

### Limitations (please read)

- **No built-in general web search**; it relies on the host agent's search tool. `literature_search` covers Europe PMC only.
- Output quality depends on the model you run it with and differs from OpenAI's RL-tuned Deep Research model.
- Abstract-only sources are flagged, but **numbers and citations should still be checked by a human before formal use** (talks, publications).
- The bundle is about 12MB (it contains a PDF parser).
- Tested on Windows + Node 22 + Codex desktop; macOS and Linux are untested.

### Development

```bash
cd plugins/deep-research
npm ci
npm test        # offline unit tests
npm run build   # regenerate dist/server.mjs
```

### License

MIT, see [LICENSE](LICENSE).
