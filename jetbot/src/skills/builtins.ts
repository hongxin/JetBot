import type { Skill } from './types';

/** Base skill definition — lifecycle fields are filled in by SkillRegistry at seed time */
type BuiltinSkillDef = Pick<Skill, 'name' | 'description' | 'trigger' | 'instructions'>;

export const builtinSkills: BuiltinSkillDef[] = [
  {
    name: 'debug',
    description: 'Systematic debugging — find root cause before fixing',
    trigger: 'bugs, errors, test failures, unexpected behavior',
    instructions: `# Systematic Debugging Mode

## Iron Law: NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST

### Phase 1: Investigate
1. **Read errors carefully** — stack traces, line numbers, error codes
2. **Reproduce** — confirm the exact symptoms
3. **Hypothesize** — list 3+ possible causes, most likely first
4. **Test each hypothesis** — use tools to verify/eliminate

### Phase 2: Fix
5. **Apply minimal fix** — change only what's needed for the root cause
6. **Verify** — confirm the fix resolves the issue without side effects

### Rules
- Never guess fixes. Gather evidence first.
- If "just one quick fix" seems obvious — be MORE suspicious, not less.
- A fix that works but you can't explain WHY is not a fix.
- Log your reasoning: "I suspect X because Y. Testing by Z."`,
  },
  {
    name: 'code-review',
    description: 'Review code for quality, security, and improvements',
    trigger: 'review, audit, check code quality',
    instructions: `# Code Review Mode

For each piece of code, systematically check:

### 1. Correctness
- Logic errors, off-by-one, null/undefined handling
- Edge cases: empty input, large input, concurrent access

### 2. Security (OWASP Top 10)
- Injection (SQL, XSS, command)
- Auth/authz issues
- Sensitive data exposure
- CSRF, SSRF

### 3. Performance
- Unnecessary loops, O(n²) where O(n) works
- Memory leaks, unbounded growth
- Missing indexes, N+1 queries

### 4. Maintainability
- Naming clarity, single responsibility
- Dead code, unnecessary complexity
- Missing error handling on boundaries

### Output Format
Rate each area: ✅ Good / ⚠️ Needs Work / ❌ Critical
Provide specific line references and corrected code.`,
  },
  {
    name: 'architect',
    description: 'Design systems and plan implementations',
    trigger: 'design, plan, architecture, how to build',
    instructions: `# Architecture & Planning Mode

### Design Process
1. **Clarify requirements** — ask what's unclear before designing
2. **Propose 2-3 approaches** — with trade-offs for each
3. **Recommend one** — explain why, considering:
   - Simplicity (prefer less complexity)
   - Existing patterns in the codebase
   - Future extensibility vs YAGNI
4. **Break into steps** — each step 2-5 minutes, independently testable

### Design Checklist
- [ ] Data flow is clear (input → processing → output)
- [ ] Error cases are handled at boundaries
- [ ] No OWASP Top 10 vulnerabilities introduced
- [ ] Rollback strategy exists
- [ ] Changes are backward compatible (or migration planned)

### Output Format
\`\`\`
## Approach: [Name]
**Pros:** ...
**Cons:** ...
**Files to change:** ...
**Steps:**
1. ...
2. ...
\`\`\``,
  },
  {
    name: 'explain',
    description: 'Explain code, concepts, or architecture clearly',
    trigger: 'explain, how does this work, what does this do',
    instructions: `# Explain Mode

### Explanation Structure
1. **One-sentence summary** — what it does, in plain language
2. **Architecture overview** — high-level flow diagram (ASCII or description)
3. **Key code walkthrough** — annotate important sections
4. **Design decisions** — why was it built this way? Trade-offs?
5. **Gotchas** — edge cases, common mistakes, non-obvious behavior

### Principles
- Match complexity to the user's level — don't over-explain basics
- Use analogies when helpful
- Code speaks louder than prose — show, don't tell
- If you don't know, say so — don't fabricate explanations`,
  },
  {
    name: 'tdd',
    description: 'Test-Driven Development: Red → Green → Refactor',
    trigger: 'write tests, test-driven, TDD',
    instructions: `# Test-Driven Development Mode

### The Cycle (repeat for each behavior)

**🔴 RED — Write a failing test first**
- Test describes the BEHAVIOR, not the implementation
- Run it. It MUST fail. If it passes, the test is wrong.

**🟢 GREEN — Write minimum code to pass**
- Only enough code to make the test pass
- No extra features, no premature optimization
- Ugly code is fine at this stage

**🔵 REFACTOR — Clean up, tests still pass**
- Remove duplication
- Improve naming
- Extract helpers if needed
- Run tests again — they must still pass

### Rules
- Never write production code without a failing test
- One behavior per test
- Test names describe what the system DOES, not how
- If you can't write a test for it, the design needs to change`,
  },
  {
    name: 'writing',
    description: 'Write documentation, READMEs, and technical content',
    trigger: 'write docs, documentation, README',
    instructions: `# Technical Writing Mode

### Principles
1. **Lead with what the reader needs** — don't bury the lede
2. **One idea per paragraph** — if a paragraph covers two ideas, split it
3. **Use concrete examples** — abstract descriptions + example > abstract alone
4. **Active voice** — "the function returns X" not "X is returned by the function"
5. **Cut ruthlessly** — every word must earn its place

### Structure for Documentation
- **Title**: What is this? (1 line)
- **Quick Start**: Get running in < 2 minutes
- **Core Concepts**: 3-5 key ideas to understand
- **API Reference**: Exhaustive but scannable
- **Examples**: Real-world usage patterns
- **Troubleshooting**: Common issues and fixes

### Structure for Technical Specs
- **Problem**: What are we solving? Why now?
- **Proposal**: How will we solve it?
- **Alternatives considered**: What else could we do?
- **Risks**: What could go wrong?`,
  },
  {
    name: 'refactor',
    description: 'Improve code structure without changing behavior',
    trigger: 'refactor, clean up, simplify',
    instructions: `# Refactoring Mode

### Golden Rule: Behavior must not change

### Process
1. **Ensure tests exist** — if not, write characterization tests first
2. **Identify the smell** — what exactly is wrong?
3. **Apply one refactoring at a time** — small, reversible steps
4. **Run tests after each step** — catch regressions immediately

### Common Refactorings
- **Extract function**: 3+ lines doing one thing → named function
- **Inline**: Single-use abstraction → just put the code there
- **Rename**: Unclear name → name that describes intent
- **Move**: Code in wrong module → move to where it belongs
- **Simplify conditional**: Nested if/else → early returns or pattern match

### Don'ts
- Don't refactor and add features at the same time
- Don't refactor code you don't understand yet
- Don't create abstractions for one use case
- Don't rename things just for style — rename for clarity`,
  },
  {
    name: 'visualize',
    description: 'Create data visualizations and HTML dashboards',
    trigger: 'chart, graph, visualize, dashboard, plot',
    instructions: `# Visualization Mode

### Process
1. **Understand the data** — what are we visualizing? What story to tell?
2. **Choose chart type**:
   - Comparison → Bar chart
   - Trend over time → Line chart
   - Proportion → Pie/donut chart
   - Distribution → Histogram
   - Relationship → Scatter plot
   - Hierarchy → Treemap
3. **Build with render_html** — create a complete HTML page with embedded JS
4. **Polish** — titles, labels, colors, responsive layout

### Technical Approach
- Use pure HTML/CSS/JS (no external CDN dependencies)
- Canvas API or SVG for charts
- Responsive design with CSS Grid/Flexbox
- Dark-mode friendly color palettes
- Include data table alongside visualization for accessibility

### Best Practices
- Always label axes and include units
- Start Y-axis at 0 unless there's a good reason not to
- Use color meaningfully, not decoratively
- Keep it simple — one clear message per chart`,
  },
  {
    name: 'decision',
    description: 'Structured decision analysis using AHP (Analytic Hierarchy Process)',
    trigger: 'decide, choose, compare, select, trade-off, which one, pros cons, evaluate alternatives',
    instructions: `# Decision Analysis Mode (Doc2AHP)

Structured multi-criteria decision analysis using the Analytic Hierarchy Process.
Turn vague "which should I pick?" into quantified, defensible recommendations.

## When to Use
- 3+ alternatives with multi-dimensional trade-offs
- Architecture, tech stack, library, or tool selection
- Decisions requiring team justification or audit trail

## When NOT to Use
- Only 2 options → simple pros/cons
- Single dimension (e.g. pure cost) → compare directly
- Urgent → trust intuition, validate later

---

## Step 0: Input Mode Selection

Ask the user which mode:

**Mode A — Document-Grounded** (recommended for high-stakes):
- Extract criteria from user-provided docs, URLs, or web search
- Every criterion tagged with source: \`[Source: doc, section]\`
- Full traceability for team buy-in and compliance

**Mode B — Quick Analysis** (for rapid exploration):
- Generate criteria from domain knowledge
- Marked as "Source: domain knowledge"
- Faster but less traceable

---

## Step 1: Decision Framework Construction

1. **Define goal** in one sentence
2. **List alternatives** (3-7, pre-screen if more)
3. **Build hierarchy**: Goal → Criteria (≤7) → Sub-criteria (≤7 each)
4. **Cognitive constraints** (Miller's Law):
   - ≤ 7 criteria per level
   - ≤ 3 hierarchy depth
   - Each criterion must be independent, measurable, relevant

Example hierarchy:
\`\`\`
Select Best Framework
├── Technical Fit (features, performance, ecosystem)
├── Team Factors (learning curve, skills, hiring)
├── Engineering Quality (maintainability, testing, docs)
└── Business Factors (license, cost, vendor lock-in)
\`\`\`

Present hierarchy and **confirm with user** before proceeding.

---

## Step 2: Multi-Perspective Evaluation

Evaluate from 3-5 perspectives:

| Perspective | Focus |
|------------|-------|
| Technical Expert | Performance, architecture, tech debt |
| Business Analyst | ROI, market fit, business value |
| Ops Engineer | Deployment, monitoring, fault recovery |
| End User | Experience, feature completeness |
| Team Lead | Learning cost, productivity, hiring |

For each perspective, create pairwise comparison matrix using **Saaty 1-9 scale**:
- 1 = Equal importance
- 3 = Slightly more important
- 5 = Clearly more important
- 7 = Strongly more important
- 9 = Extremely more important

Show each matrix explicitly.

---

## Step 3: Consensus Aggregation

1. **Geometric mean** across perspectives for each pair:
   \`consensus_ij = (a_ij_p1 × a_ij_p2 × ... × a_ij_pK)^(1/K)\`
2. Apply user priority constraints (e.g. "performance first" → boost related criteria 1-2 levels)
3. Compute normalized weights per criterion
4. Present weight distribution as table + bar chart description

---

## Step 4: Consistency Check

1. **Transitivity**: If A > B and B > C, then A must > C
2. Flag contradictions, propose corrections
3. Recompute weights after fixes
4. Brief note on confidence level

---

## Step 5: Alternative Scoring

1. Score each alternative per sub-criterion (1-10 scale)
2. Compute weighted sum: \`Score = Σ(weight_i × score_i)\`
3. **Sensitivity analysis**: adjust top-2 weights by ±20%, check if ranking changes
4. Present as ranked table

---

## Step 6: Decision Report

Output structured report:

\`\`\`markdown
# Decision: [Goal]

## Recommendation
**[Winner]** — Score: X.XX / 10

## Ranking
| Rank | Alternative | Score | Key Strength |
|------|------------|-------|-------------|
| 1    | ...        | ...   | ...         |

## Weight Distribution
[Criteria weights table]

## Key Trade-offs
- Alt A leads in X but trails in Y
- Sensitivity: if Z weight +20%, ranking changes to...

## Risks & Mitigations
[Top risks of recommended option]

## Next Steps
[Actionable items]
\`\`\`

---

## Rules
- Always show your math — transparency builds trust
- Confirm hierarchy with user before computing
- Acknowledge uncertainty explicitly
- If user overrides a weight, respect it and note the adjustment
- For simple decisions (≤3 criteria, ≤3 alternatives), compress Steps 2-4 into one pass`,
  },
  {
    name: 'security',
    description: 'Security audit — OWASP Top 10, threat modeling, hardening',
    trigger: 'security, vulnerability, audit, hardening, OWASP, threat',
    instructions: `# Security Audit Mode

## Scope First
Ask: What are we securing? (API endpoint, full app, specific module, deployment config)

## Systematic Check (OWASP Top 10 + extras)

### 1. Injection (SQLi, XSS, Command)
- User input flows → trace from entry to output
- Check: parameterized queries, output encoding, command escaping
- Template literals with user data? \`dangerouslySetInnerHTML\`?

### 2. Broken Authentication
- Session management, token storage, password handling
- JWT validation, expiry, refresh flow
- Rate limiting on auth endpoints

### 3. Sensitive Data Exposure
- Secrets in code, logs, or git history
- HTTPS enforcement, CORS policy
- API keys in frontend code?

### 4. Broken Access Control
- Authorization checks on every endpoint
- IDOR (Insecure Direct Object References)
- Privilege escalation paths

### 5. Security Misconfiguration
- Default credentials, debug mode in production
- Unnecessary ports/services exposed
- Missing security headers (CSP, HSTS, X-Frame-Options)

### 6. Dependency Vulnerabilities
- Known CVEs in dependencies
- Outdated packages with security patches
- Lock file integrity

### 7. Additional Checks
- Path traversal (\`../\` in file operations)
- SSRF (Server-Side Request Forgery)
- Regex DoS (ReDoS)
- Race conditions in concurrent operations

## Output Format
For each finding:
\`\`\`
**[SEVERITY]** Title
- Location: file:line
- Risk: what could happen
- Fix: specific code change
- Verify: how to confirm the fix works
\`\`\`

Severity: CRITICAL / HIGH / MEDIUM / LOW / INFO`,
  },
  {
    name: 'perf',
    description: 'Performance analysis — find bottlenecks, optimize hot paths',
    trigger: 'slow, performance, optimize, bottleneck, latency, memory',
    instructions: `# Performance Analysis Mode

## Step 1: Measure Before Optimizing
- Never optimize without evidence of a bottleneck
- Ask: What is slow? How slow? What is the target?
- Identify the hot path (the 20% of code causing 80% of time)

## Step 2: Classify the Bottleneck

| Type | Symptoms | Tools |
|------|----------|-------|
| CPU-bound | High CPU, slow computation | Profiler, flame graphs |
| I/O-bound | Waiting on network/disk | Async tracing, waterfall |
| Memory | High RSS, GC pauses, OOM | Heap snapshots |
| Render | Janky UI, dropped frames | Performance timeline |
| Algorithm | O(n²) where O(n) works | Code inspection |

## Step 3: Common Fixes by Category

### Algorithm & Data Structure
- O(n²) → O(n log n) or O(n) with better data structure
- Repeated lookups → Map/Set instead of array scan
- String concatenation in loop → array push + join

### I/O & Network
- Sequential requests → Promise.all() for independent calls
- Missing caching → add memoization or HTTP cache
- Large payloads → pagination, compression, selective fields

### Rendering (Frontend)
- Excessive re-renders → React.memo, useMemo, useCallback
- Layout thrashing → batch DOM reads/writes
- Large lists → virtualization (windowing)
- Heavy computation → Web Worker

### Memory
- Unbounded caches → LRU with max size
- Event listener leaks → cleanup in useEffect/destroy
- Large object retention → WeakRef/WeakMap

## Rules
- One optimization at a time — measure after each
- Readability > micro-optimization unless proven bottleneck
- Document WHY the optimization exists (future maintainers)
- If < 2x improvement, consider if complexity is worth it`,
  },

  // ── ZPower 五行技能系统 ──────────────────────────────────────

  {
    name: 'zpower',
    description: 'Five Elements development framework — observe, design, build, verify, evolve',
    trigger: 'workflow, methodology, which phase, what should I do next, stuck',
    instructions: `# ZPower — 从零到极

> Z = 零(Zero) + 至(Zenith) + 之(the path). 道生一，一生五行，五行生万物。

## 五行技能图

\`\`\`
        z-observe (观·水)
       ╱ 金生水↑    ↓水生木 ╲
z-evolve (化·金)      z-design (谋·木)
       ↑ 土生金              木生火 ↓
z-verify (验·土) ←── 火生土 ── z-build (行·火)
\`\`\`

**相生（自然流转）：** 观→谋→行→验→化→观…
**相克（纠偏机制）：** 观克行(调研否定盲干)｜谋克验(设计约束测试)｜行克化(实践检验理论)｜验克观(证据终止探索)｜化克谋(经验简化规划)

## 阶段判断

| 信号 | 五行 | 技能 | 核心动作 |
|------|------|------|---------|
| 不熟悉的代码/项目 | 水 | /skill z-observe | 探索、建立认知 |
| 需要做设计决策 | 木 | /skill z-design | 头脑风暴、写计划 |
| 计划就绪可以开干 | 火 | /skill z-build | TDD、渐进式构建 |
| 实现完成需要验证 | 土 | /skill z-verify | 望闻问切、测试 |
| 通过验证待收官 | 金 | /skill z-evolve | 审查、提炼、收官 |

## 相克预警

当你在某个阶段停滞不前时，启动相克机制：
- 探索太久？→ 验(土)克观(水)：拿出现有证据，停止探索
- 规划太久？→ 化(金)克谋(木)：用经验直接简化
- 编码太久？→ 观(水)克行(火)：回头确认方向
- 测试太久？→ 谋(木)克验(土)：回到设计约束范围
- 总结太久？→ 行(火)克化(金)：去实践检验

## 渐进式构建原则

- **每步足够小**（30-90分钟），每步有可见产出
- **去魔化**：复杂系统是由简单部分组成的
- **即时反馈**：每个 milestone 都有可运行的成果`,
  },
  {
    name: 'z-observe',
    description: '观·水 — Explore unfamiliar code, build mental model before acting',
    trigger: 'explore, unfamiliar code, new project, what is this, understand codebase',
    instructions: `# z-observe — 观·水

> 「知止而后有定」— 水无常形，因地制流。探索方法应适应项目地形。

## 三层探索法

### 1. 鸟瞰 — 全局结构
- \`list_dir\` + \`search_text\` → 目录结构、文件类型分布
- 识别：README、配置文件、入口点、测试目录
- **目标**：30秒内形成项目心智地图

### 2. 走径 — 关键路径
- \`search_text\` + \`read_file\` → 核心模块、API入口、数据模型
- 追踪：import链、调用关系、配置流向
- **目标**：找到任务相关的3-5个关键文件

### 3. 潜渊 — 深度理解
- 跨文件阅读 → 语义理解、架构模式识别
- 仅在前两层不足以理解时使用
- **目标**：能清晰描述组件关系和数据流

## 止观法则

**何时停止探索（止）：**
- 能用一句话描述任务边界
- 已识别要修改的文件和函数
- 已知道现有的测试覆盖情况
- 已发现可能的风险点

**探索过度的信号：**
- 已读了 >10 个与任务无关的文件
- 在"了解更多背景"中循环
- 开始关注非任务区域的代码质量

## 禹步量地

对于大型未知项目，三步定位：
1. **步一**：找到项目的"心脏"（主入口/核心模块）
2. **步二**：找到与任务相关的"经脉"（调用链）
3. **步三**：找到变更的"穴位"（具体修改点）

## 流转

**水生木**：探索完成 → 自然流入 \`/skill z-design\` 进行规划。
**土克水**：若已有充分证据，无需再探索。`,
  },
  {
    name: 'z-design',
    description: '谋·木 — Plan implementation with trade-off analysis before coding',
    trigger: 'how to implement, design, plan approach, multiple options, trade-off',
    instructions: `# z-design — 谋·木

> 「谋定而后动」— 木向阳而生，有枝有干。方案应有清晰主干和合理分支。

## 五德评估法（素书）

对每个方案快速过五德：

| 德 | 问题 | 权重 |
|----|------|------|
| **道**（深度） | 是否触及问题本质？ | 必须 |
| **德**（质量） | 代码是否可维护？ | 必须 |
| **仁**（体验） | 使用者是否便利？ | 重要 |
| **义**（正确） | 逻辑是否严密？ | 必须 |
| **礼**（规范） | 是否遵循已有约定？ | 重要 |

**五德全满不可能也不必要。道·德·义三者为必须，仁·礼可权衡。**

## 设计流程

### 1. 发散 — brainstorming
- 列出 2-4 个可行方案（不少于2个）
- 用五德评估法快速打分
- 复杂决策可激活 \`/skill decision\` 做 AHP 量化分析

### 2. 收敛 — 方案选择
- 选择五德综合最优的方案
- 记录被否方案的原因（防止重蹈覆辙）
- 识别关键风险和回滚策略

### 3. 成文 — 实施计划
- 拆分为渐进式步骤（Build-Your-Own-X 理念）
- 每步 2-5 分钟可完成
- 每步有明确的验证标准

## 渐进式拆分原则

- **大任务 → 小步骤**：每步足够小到不会迷路
- **每步有产出**：可编译、可运行、可测试
- **难度曲线控制**：保持在心流区间

## 流转

**木生火**：计划就绪 → 自然流入 \`/skill z-build\` 开始实施。
**金克木**：经验丰富时可简化规划，别过度设计简单任务。`,
  },
  {
    name: 'z-build',
    description: '行·火 — Build progressively with TDD discipline',
    trigger: 'implement, code it, start building, write the code, execute plan',
    instructions: `# z-build — 行·火

> 「道常无为而无不为」— 火之道，不疾不徐，渐燃渐明。

## TDD 铁律（火之三相）

### 🔴 点火 RED — 先写测试
写一个会失败的测试——无火种不生焰。
- 测试描述期望行为，不是实现细节
- 运行测试，确认它**确实**失败了

### 🟢 燃烧 GREEN — 最少代码通过
写最少的代码使测试通过——火只燃其所需。
- 不写测试未要求的功能
- 不提前优化，不提前抽象

### 🔵 淬炼 REFACTOR — 清理代码
测试通过后清理——火后铸器。
- 消除重复，提取清晰命名
- 再次运行测试确认不破坏

**循环：RED → GREEN → REFACTOR → RED → …**

## 渐进式构建

\`\`\`
第1步：最简可运行版本（骨架）
  ↓ 验证通过
第2步：添加核心功能（肌肉）
  ↓ 验证通过
第3步：处理边界情况（皮肤）
  ↓ 验证通过
第4步：优化和美化（衣服）
\`\`\`

- **每步 30-90 分钟可完成**
- **每步有可见产出**（能运行、能演示）

## 编码纪律

- 写代码前确认测试策略
- 每个函数做一件事（单一职责）
- 命名即文档，复杂处加注释
- 不引入 OWASP Top 10 漏洞

## 流转

**火生土**：代码完成 → 自然流入 \`/skill z-verify\` 进行验证。
**水克火**：若调研不足，回到 \`/skill z-observe\`。方向不明时不要蛮干。`,
  },
  {
    name: 'z-verify',
    description: '验·土 — Verify with evidence, not confidence — diagnose before declaring success',
    trigger: 'verify, test, check, does it work, is it correct, diagnose',
    instructions: `# z-verify — 验·土

> 「格物致知」— 土为万物之验。不经大地承载的，皆是浮云。

## 望闻问切四诊法

### 望 Look — 观其表象
- 读错误信息全文（不要只看第一行）
- 查日志输出、控制台警告
- 看 diff：改了什么，遗漏了什么

### 闻 Listen — 闻其声息
- 听用户描述：关注"本来应该"和"实际发生"的差异
- 查文档/社区：相同错误是否有已知解法

### 问 Ask — 问其病史
- 最近改了什么？
- 环境差异？（版本、配置、浏览器）
- 能否稳定复现？条件是什么？

### 切 Feel — 切其脉象
- 追踪数据流：输入→处理→输出每步的实际值
- 二分排查：哪一步开始出错？
- 加日志/断点：确认假设而非猜测

## 验证铁律

**证据先于断言，始终如此。**
1. 运行命令/测试 → 2. 阅读输出 → 3. 然后才能宣称结果
绝不说"应该可以了"——运行验证，展示证据。

## 验证清单

- [ ] 所有新增/修改的代码编译通过
- [ ] 核心路径手动确认正常
- [ ] 边界条件已覆盖
- [ ] 无遗留调试代码
- [ ] diff 审查无意外改动

## 流转

**土生金**：验证通过 → 自然流入 \`/skill z-evolve\` 收官。
**谋克验**：不要漫无目的测试，回到设计约束范围。
**Related**: \`/skill debug\` 用于深度根因分析。`,
  },
  {
    name: 'z-evolve',
    description: '化·金 — Review, refine, and capture knowledge after verification',
    trigger: 'review, finalize, wrap up, commit, merge, lessons learned',
    instructions: `# z-evolve — 化·金

> 「日新其德」— 金之道，百炼成钢，去粗存精。

## 三化路径

### 淬化 — Code Review
代码审查，去除杂质。
- 检查：命名清晰？职责单一？安全无漏洞？
- 关注业务逻辑正确性，而非格式琐事
- 可激活 \`/skill code-review\` 做结构化审查

### 结化 — Integration
合并收官，归于主干。
- 确认所有测试/编译通过（z-verify 已完成）
- 清理临时代码、调试日志
- 撰写清晰的 commit message

### 升化 — Knowledge Capture
提炼经验为可复用知识。
- 发现的模式值得记录？→ 写下来
- 流程值得固化？→ 提取为规范
- 本次踩过的坑？→ 记录避免重蹈

## 文心雕龙写作原则

| 原则 | 含义 | 实践 |
|------|------|------|
| **风骨** | 主旨鲜明 | 开头一句话说清目的 |
| **通变** | 借鉴不拘泥 | 参考已有模式但适应新场景 |
| **练字** | 字字有用 | 无一虚设，效率优先 |

## 进化判断

**何时淬化：** 代码可工作但不够干净
**何时结化：** 代码干净且验证通过，准备合并
**何时升化：** 本次工作产生了可复用的洞察

**三化可并行，但至少做淬化和结化。升化视情况而定。**

## 流转

**金生水**：本轮完成 → 开启新一轮 \`/skill z-observe\` 循环。
**火克金**：理论须经实践检验。别空谈——去 \`/skill z-build\` 证明。`,
  },
  {
    name: 'z-diagram',
    description: '图·象 — Create system diagrams and visualizations',
    trigger: 'diagram, draw, flowchart, architecture diagram, sequence diagram, visualize system',
    instructions: `# z-diagram — 图·象

> 「圣人立象以尽意」——《周易·系辞上》。图为意之象，选对图法，方能尽意。

## 核心原则

**图的拓扑决定工具选择，而非工具决定图的形态。**

## 图类型判定

| 需求 | 推荐方法 | 理由 |
|------|---------|------|
| 线性流程、树形结构 | Mermaid (代码块) | LLM 生成质量高，直接渲染 |
| 环形/交叉/自由布局 | SVG via \`render_html\` | 完全控制坐标和样式 |
| 简单时序图 | Mermaid sequenceDiagram | 原生支持 |
| UML 类图 | Mermaid classDiagram | 足够简单场景 |
| 概念图/架构图 | SVG + HTML via \`render_html\` | Excalidraw 手绘风格 |

## 方法一：Mermaid（速图之法）

在 Markdown 中嵌入 Mermaid 代码块即可：

\`\`\`
graph TD
  A[用户输入] --> B{是否命令?}
  B -->|是| C[命令处理]
  B -->|否| D[LLM 对话]
  D --> E[工具调用]
  E --> D
\`\`\`

**要点：**
- 用 \`classDef\` 自定义节点颜色
- \`subgraph\` 做分组，不超过 3 层嵌套
- 节点超过 15 个时考虑拆图

## 方法二：SVG via render_html（意图之法）

用 \`render_html\` 工具生成包含 SVG 的 HTML 页面：

\`\`\`html
<svg viewBox="0 0 800 600">
  <defs>
    <filter id="rough">
      <feTurbulence baseFrequency="0.03" numOctaves="4" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.5"/>
    </filter>
    <marker id="arrow" viewBox="0 0 10 7" refX="10" refY="3.5"
            markerWidth="10" markerHeight="7" orient="auto-start-reverse">
      <polygon points="0 0, 10 3.5, 0 7" fill="#555"/>
    </marker>
  </defs>
  <!-- 节点：<g> + <rect> + <text> -->
  <!-- 连线：<path d="M... C..."> 贝塞尔曲线 -->
</svg>
\`\`\`

**布局策略：**
- **环形布局**：N 节点均匀分布在圆周上
- **层次布局**：上下或左右分层
- 实线表示主要关系，虚线表示次要关系
- 颜色编码区分不同类别

## 工作流程

1. **判型（望）**：这张图的核心拓扑是什么？
2. **生成（行）**：选择合适方法，生成图表代码
3. **渲染（化）**：Mermaid → Markdown 嵌入 / SVG → render_html 预览
4. **验证（验）**：布局是否表达语义？文字是否清晰？

## 常见陷阱

| 陷阱 | 纠偏 |
|------|------|
| 用 Mermaid 画环形图 → 变成面条 | 改用 SVG via render_html |
| 图中信息过多 | 一张图只表达一个核心概念 |
| 为了美观选错工具 | 先保证拓扑正确，再追求美观 |

> *立象以尽意，选器以达道。*`,
  },
];
