import type { LLMClient } from '../types/llm';
import type { AgentEvent, Turn } from '../types/message';
import { ContextManager } from './ContextManager';
import { SystemPromptBuilder } from './SystemPromptBuilder';
import { AgenticLoop, type LoopStats } from './AgenticLoop';
import { ToolRegistry } from '../tools/ToolRegistry';
import { PermissionManager } from '../tools/Permission';
import { PlanMode } from '../plan/PlanMode';
import { SkillRegistry } from '../skills/SkillRegistry';
import { SessionStore } from './SessionStore';
import { SessionIndex } from './SessionIndex';
import { MemoryStore } from './MemoryStore';
import { shouldDistill, distillFromMessages, type DistillProposal } from './SkillDistiller';
import { Scheduler } from '../scheduler/Scheduler';
import type { HeartbeatConfig } from '../scheduler/types';
import { detectRuntime } from '../env/RuntimeDetector';
import type { RuntimeProfile } from '../env/types';
import { t } from '../lib/i18n';
import { logger } from '../lib/logger';

const log = logger.module('agent');

export type AgentEventCallback = (event: AgentEvent) => void;

export type InjectionCallback = (prompt: string, source: string) => Promise<void>;

export interface AgentConfig {
  llm: LLMClient;
  permissionConfirmFn: (toolName: string, params: Record<string, unknown>, isDangerous: boolean) => Promise<import('../store/chatStore').PermissionResponse>;
  onEvent: AgentEventCallback;
  /** Called when scheduler/heartbeat wants to inject a message. Goes through agentStore for UI visibility. */
  onInject?: InjectionCallback;
}

export class Agent {
  private llm: LLMClient;
  private context: ContextManager;
  private promptBuilder: SystemPromptBuilder;
  private loop: AgenticLoop;
  private tools: ToolRegistry;
  private permission: PermissionManager;
  private planMode: PlanMode;
  private skills: SkillRegistry;
  private onEvent: AgentEventCallback;
  private running = false;
  private pendingInjections: Array<{ prompt: string; source: string }> = [];
  private drainConsecutiveFailures = 0;
  private static readonly MAX_DRAIN_FAILURES = 3;
  private scheduler: Scheduler;
  private autoMode = false;
  private runtime: RuntimeProfile;
  private onInjectCallback: InjectionCallback | null = null;
  private soulReady: Promise<void>;
  private sessionStore: SessionStore;
  private sessionIndex: SessionIndex;
  private memoryStore: MemoryStore;
  private itersSinceDistill = 0;

  constructor(config: AgentConfig) {
    this.llm = config.llm;
    this.context = new ContextManager();
    this.promptBuilder = new SystemPromptBuilder();
    this.loop = new AgenticLoop();

    // Detect runtime environment FIRST — capabilities drive tool loading
    this.runtime = detectRuntime();

    // ToolRegistry receives capabilities → only loads compatible tools
    this.tools = new ToolRegistry(this.runtime.capabilities);

    this.permission = new PermissionManager(config.permissionConfirmFn);

    // Sync tool permission levels → PermissionManager
    // Without this, all tools default to 'dangerous' and prompt every time
    for (const tool of this.tools.list()) {
      this.permission.setLevel(tool.name, tool.permission);
    }

    this.planMode = new PlanMode();
    this.skills = new SkillRegistry();
    this.sessionStore = new SessionStore();
    this.sessionIndex = new SessionIndex();
    this.memoryStore = new MemoryStore();
    this.onEvent = config.onEvent;
    this.onInjectCallback = config.onInject ?? null;

    this.scheduler = new Scheduler((prompt, taskId) => this.injectMessage(prompt, taskId === '__heartbeat__' ? 'heartbeat' : 'scheduler'));
    // Scheduler methods internally await ready, so no race condition even if init is still in progress
    this.scheduler.init().then(() => this.scheduler.start()).catch(err => log.error('scheduler init failed', { error: err.message }));

    // Listen for distill card save/discard events
    document.addEventListener('jetbot:distill:save', ((e: CustomEvent) => {
      const { msgId, proposal } = e.detail as { msgId: string; proposal: DistillProposal };
      this.skills.addSkill(proposal.name, proposal.description, proposal.triggers, proposal.tools, proposal.instructions);
      import('../store/chatStore').then(m => m.useChatStore.getState().resolveDistillProposal(msgId, true));
      // Notify Cosmos that a new skill crystallized from this turn (anchor by msgId)
      document.dispatchEvent(new CustomEvent('jetbot:skill:distilled-accepted', {
        detail: { proposal, anchorMsgId: msgId },
      }));
    }) as EventListener);
    document.addEventListener('jetbot:distill:discard', ((e: CustomEvent) => {
      import('../store/chatStore').then(m => m.useChatStore.getState().resolveDistillProposal((e.detail as { msgId: string }).msgId, false));
    }) as EventListener);

    // Load soul file (jetbot.md) from VirtualFS — awaited in handle() before first LLM call
    this.soulReady = this.promptBuilder.loadSoulFile(this.tools.fs).catch(err =>
      log.error('soul file load failed', { error: err.message })
    );

    // Inject rich environment profile instead of minimal "Browser" string
    this.promptBuilder.setEnvironmentFromProfile(this.runtime);
    this.promptBuilder.setToolDescriptions(
      this.tools.schemas().map(s => ({ name: s.function.name, description: s.function.description }))
    );

    log.info('agent initialized', {
      runtime: this.runtime.type,
      capabilities: this.runtime.capabilities.size,
      tools: this.tools.list().length,
      mobile: this.runtime.mobile,
    });
  }

  async handle(input: string): Promise<{ response: string; stats?: LoopStats }> {
    // Slash commands
    if (input.startsWith('/')) {
      log.debug('command', { input });
      return await this.handleCommand(input);
    }

    log.info('handle start', { inputLength: input.length });
    this.running = true;

    // Ensure soul file is loaded before first LLM call
    await this.soulReady;

    // Session lifecycle — first turn only
    if (this.context.turnCount() === 0) {
      await this.sessionStore.ready();
      await this.sessionIndex.ready();
      await this.memoryStore.ready();
      await this.skills.ready();
      this.promptBuilder.setSkillMenu(this.skills.list());
      await this.sessionStore.start('browser', this.llm.model());

      // Inject memory context
      const memoryCtx = this.memoryStore.recentContext(2000);
      this.promptBuilder.setMemoryContext(memoryCtx);

      // Cross-session recall
      const recall = this.sessionIndex.recallContext(input, 1500);
      this.promptBuilder.setSessionRecall(recall);
    }

    // Adapt context budget for current model
    this.context.adaptForModel(this.llm.model());

    this.context.addUserMessage(input);

    // Refresh skill menu each turn — skills may change via UI or distill events
    this.promptBuilder.setSkillMenu(this.skills.list());

    // Build system prompt with plan mode and active skill
    let systemPrompt = this.promptBuilder.build();
    if (this.planMode.isActive()) {
      systemPrompt += '\n\n' + this.planMode.getPromptSection();
    }
    const activeSkill = this.skills.getActive();
    if (activeSkill) {
      systemPrompt += '\n\n# Active Skill: ' + activeSkill.name + '\n\n' + activeSkill.instructions;
    }

    try {
      const { finalResponse, stats } = await this.loop.run(
        this.llm,
        this.tools,
        this.context,
        systemPrompt,
        this.onEvent,
        this.permission,
        (chunk) => this.onEvent({ type: 'llm:chunk', data: { chunk }, timestamp: Date.now() }),
      );
      log.info('handle done', { iterations: stats.iterations, toolCalls: stats.toolCalls, tokens: stats.totalTokens, duration: stats.duration });

      // Persist last 2 turns to SessionStore
      const turns = this.context.turnsRef();
      const newTurns = turns.slice(-2);
      for (const t of newTurns) {
        this.sessionStore.appendTurn(t).catch(() => {});
      }

      // Distillation check
      this.itersSinceDistill++;
      if (this.itersSinceDistill >= 8 && stats && shouldDistill(input, stats.toolCalls, stats.toolCalls)) {
        this.itersSinceDistill = 0;
        this.tryDistill(input, finalResponse, turns).catch(() => {});
      }

      return { response: finalResponse, stats };
    } finally {
      this.running = false;
      // Process queued injections
      this.drainPendingInjections();
    }
  }

  /**
   * Called by Scheduler when a task/heartbeat fires.
   * Routes through onInjectCallback (→ agentStore) so the message appears in UI.
   * Falls back to direct handle() if no callback is set.
   */
  async injectMessage(prompt: string, source: string): Promise<void> {
    if (this.running) {
      log.debug('injection queued', { source, queueSize: this.pendingInjections.length + 1 });
      this.pendingInjections.push({ prompt, source });
      return;
    }

    log.info('inject message', { source, promptLength: prompt.length });

    if (this.onInjectCallback) {
      // Route through agentStore — this shows the trigger in UI
      await this.onInjectCallback(prompt, source);
    } else {
      // Fallback: direct handle (no UI visibility for the trigger)
      const taggedPrompt = `[${source}] ${prompt}`;
      await this.handle(taggedPrompt);
    }
  }

  /**
   * Drain ALL queued injections sequentially, with error isolation.
   * Each injection is processed after a short delay to avoid stack overflow.
   * Stops after MAX_DRAIN_FAILURES consecutive failures to prevent infinite loops.
   */
  private drainPendingInjections(): void {
    if (this.pendingInjections.length === 0) {
      this.drainConsecutiveFailures = 0;
      return;
    }
    const next = this.pendingInjections.shift()!;
    log.debug('draining injection', { source: next.source, remaining: this.pendingInjections.length });
    // Use setTimeout to break out of the finally block's call stack
    setTimeout(async () => {
      try {
        await this.injectMessage(next.prompt, next.source);
        this.drainConsecutiveFailures = 0;
      } catch (err: any) {
        this.drainConsecutiveFailures++;
        log.error('drain injection failed', { source: next.source, error: err.message, consecutiveFailures: this.drainConsecutiveFailures });
        if (this.drainConsecutiveFailures >= Agent.MAX_DRAIN_FAILURES) {
          const dropped = this.pendingInjections.length;
          this.pendingInjections.length = 0;
          this.drainConsecutiveFailures = 0;
          log.warn('drain circuit breaker tripped — dropped remaining injections', { dropped, maxFailures: Agent.MAX_DRAIN_FAILURES });
          return;
        }
        // Continue draining — failure count not yet at limit
        this.drainPendingInjections();
      }
    }, 200);
  }

  private async handleCommand(input: string): Promise<{ response: string }> {
    const [cmd, ...args] = input.trim().split(/\s+/);
    switch (cmd) {
      case '/help':
        return { response: this.helpText() };
      case '/clear':
        this.skills.saveAll().catch(() => {});
        this.sessionStore.end().catch(() => {});
        this.context.clear();
        return { response: t('cmd.cleared') };
      case '/status':
        return { response: `Model: ${this.llm.model()}\nTurns: ${this.context.turnCount()}\nTokens: ~${this.context.currentTokenEstimate()}\nPlan Mode: ${this.planMode.isActive() ? this.planMode.currentPhase() : 'off'}\nSkill: ${this.skills.getActiveName() ?? 'none'}\nAuto Mode: ${this.autoMode ? 'on (risky=auto, dangerous=once)' : 'off'}\nRuntime: ${this.runtime.type} (${this.runtime.capabilities.size} capabilities, ${this.tools.list().length} tools)` };
      case '/runtime':
        return { response: this.runtimeInfo() };
      case '/model':
        return { response: `Current model: ${this.llm.model()}` };
      case '/plan': {
        if (args.length === 0) {
          if (this.planMode.isActive()) {
            this.planMode.deactivate();
            return { response: t('cmd.plan_deactivated') };
          }
          return { response: t('cmd.plan_usage') };
        }
        const goal = args.join(' ');
        this.planMode.activate(goal);
        return { response: `${t('cmd.plan_activated')}\n${t('cmd.goal')}: ${goal}\n${t('cmd.phase')}: ${this.planMode.currentPhase()}\n${t('cmd.use_next')}` };
      }
      case '/next':
        if (!this.planMode.isActive()) {
          return { response: t('cmd.not_in_plan') };
        }
        this.planMode.nextPhase();
        return { response: `${t('cmd.advanced_to')}: ${this.planMode.currentPhase()}` };
      case '/schedule':
        return this.handleScheduleCommand(args);
      case '/sessions':
        return this.handleSessionsCommand(args);
      case '/memory':
        return this.handleMemoryCommand(args);
      case '/skill':
        return this.handleSkillCommand(args);
      case '/export':
        return this.handleExportCommand(args);
      case '/auto':
        return this.handleAutoCommand(args);
      default:
        return { response: `${t('cmd.unknown')}: ${cmd}. ${t('cmd.type_help')}` };
    }
  }

  private async handleScheduleCommand(args: string[]): Promise<{ response: string }> {
    const sub = args[0];
    switch (sub) {
      case 'list': {
        const tasks = await this.scheduler.listTasks();
        if (tasks.length === 0) return { response: t('schedule.empty') };
        const lines = tasks.map(
          t => `- **${t.name}** [${t.status}] trigger=${this.formatTrigger(t.trigger)} runs=${t.runCount} last=${t.lastRunAt ? new Date(t.lastRunAt).toLocaleTimeString() : '—'}`,
        );
        return { response: `${t('schedule.list')}:\n${lines.join('\n')}` };
      }
      case 'add': {
        // /schedule add <name> <trigger> <prompt...>
        if (args.length < 4) {
          return { response: t('schedule.addUsage') };
        }
        const [, name, trigger, ...promptParts] = args;
        const prompt = promptParts.join(' ');
        try {
          const id = await this.scheduler.addTask(name, prompt, trigger);
          return { response: `${t('schedule.added')}: ${name} (${id.slice(0, 8)})` };
        } catch (err: any) {
          return { response: `Error: ${err.message}` };
        }
      }
      case 'remove': {
        const id = args[1];
        if (!id) return { response: 'Usage: /schedule remove <id>' };
        const ok = await this.scheduler.removeTask(id);
        return { response: ok ? t('schedule.removed') : t('schedule.notFound') };
      }
      case 'pause': {
        const id = args[1];
        if (!id) return { response: 'Usage: /schedule pause <id>' };
        const ok = await this.scheduler.pauseTask(id);
        return { response: ok ? t('schedule.paused') : t('schedule.notFound') };
      }
      case 'resume': {
        const id = args[1];
        if (!id) return { response: 'Usage: /schedule resume <id>' };
        const ok = await this.scheduler.resumeTask(id);
        return { response: ok ? t('schedule.resumed') : t('schedule.notFound') };
      }
      default:
        return { response: t('schedule.usage') };
    }
  }

  private handleSkillCommand(args: string[]): { response: string } {
    const sub = args[0];
    if (!sub || sub === 'list') {
      const items = this.skills.list();
      const lines = items.map(s =>
        `- **${s.name}**${s.active ? ' ✦' : ''}: ${s.description}`
      );
      const active = this.skills.getActiveName();
      return { response: `${t('skill.list')}:\n${lines.join('\n')}${active ? `\n\n_Active: ${active}_` : ''}` };
    }
    if (sub === 'off') {
      if (!this.skills.getActiveName()) {
        return { response: t('skill.noActive') };
      }
      this.skills.deactivate();
      return { response: t('skill.deactivated') };
    }
    if (sub === 'status') {
      const name = args[1];
      if (!name) return { response: 'Usage: /skill status <name>' };
      const stats = this.skills.usageStats(name);
      if (!stats) return { response: `${t('skill.notFound')}: ${name}` };
      const s = this.skills.get(name)!;
      const stageLabel: Record<string, string> = {
        new: '✿ New', active: '● Active', stable: '★ Stable', stale: '⏳ Stale', deprecated: '✗ Deprecated',
      };
      return { response: [
        `**${s.name}** v${s.version}`,
        `Description: ${s.description}`,
        `Stage: ${stageLabel[s.lifecycleStage] || s.lifecycleStage}`,
        `Usage: ${stats.useCount} | Quality: ${(stats.qualityScore * 100).toFixed(0)}%`,
        `Origin: ${s.originManual ? 'Built-in/Manual' : 'Distilled'}`,
        `Created: ${new Date(s.createdAt).toLocaleDateString()}`,
        s.lastUsedAt ? `Last used: ${new Date(s.lastUsedAt).toLocaleDateString()}` : '',
        s.trigger ? `Triggers: ${s.trigger}` : '',
        s.tools?.length ? `Tools: ${s.tools.join(', ')}` : '',
      ].filter(Boolean).join('\n') };
    }
    if (sub === 'delete') {
      const name = args[1];
      if (!name) return { response: 'Usage: /skill delete <name>' };
      const s = this.skills.get(name);
      if (!s) return { response: `${t('skill.notFound')}: ${name}` };
      if (s.originManual) return { response: 'Cannot delete built-in skills.' };
      this.skills.remove(name);
      return { response: `Deleted skill: **${name}**` };
    }
    if (sub === 'export') {
      const name = args[1];
      if (!name) return { response: 'Usage: /skill export <name>' };
      const content = this.skills.exportSkill(name);
      if (!content) return { response: `${t('skill.notFound')}: ${name}` };
      const event = new CustomEvent('jetbot:export', {
        detail: { content, filename: `${name}.SKILL.md`, path: `/${name}.SKILL.md` },
      });
      document.dispatchEvent(event);
      return { response: `Exported **${name}** -> \`${name}.SKILL.md\`` };
    }
    // Activate by name
    const ok = this.skills.activate(sub);
    if (!ok) {
      return { response: `${t('skill.notFound')}: ${sub}. ${t('skill.usage')}` };
    }
    return { response: `${t('skill.activated')}: **${sub}**` };
  }

  private async handleExportCommand(args: string[]): Promise<{ response: string }> {
    const path = args[0];
    if (!path) {
      return { response: 'Usage: /export <path>  — Download a VirtualFS file to your local filesystem.' };
    }
    const fs = this.tools.fs;
    try {
      const content = await fs.readFile(path);
      const filename = path.split('/').pop() || 'download.txt';
      const event = new CustomEvent('jetbot:export', {
        detail: { content, filename, path },
      });
      document.dispatchEvent(event);
      return { response: `Exported **${path}** (${content.length} bytes) → downloading as \`${filename}\`` };
    } catch {
      return { response: `File not found: ${path}` };
    }
  }

  private handleAutoCommand(args: string[]): { response: string } {
    const sub = args[0];
    if (sub === 'on') {
      this.autoMode = true;
      this.permission.autoMode = true;
      const config: HeartbeatConfig = {
        enabled: true,
        intervalMs: 5 * 60_000,
        prompt: '', // Will be replaced by dynamic prompt at fire time
      };
      // Use a dynamic heartbeat that injects context
      this.scheduler.startHeartbeat(config, () => this.buildHeartbeatPrompt());
      return { response: t('auto.on') };
    }
    if (sub === 'off') {
      this.autoMode = false;
      this.permission.autoMode = false;
      this.scheduler.stopHeartbeat();
      return { response: t('auto.off') };
    }
    return { response: `Usage: /auto on|off` };
  }

  /**
   * Build a context-aware heartbeat prompt.
   * Instead of a static "check for tasks", this tells the LLM what's actually
   * going on so it can make informed decisions.
   */
  private buildHeartbeatPrompt(): string {
    const parts: string[] = [
      'Heartbeat check-in. Here is the current state:',
    ];

    // Conversation context
    const turns = this.context.turnCount();
    const tokens = this.context.currentTokenEstimate();
    parts.push(`- Conversation: ${turns} turns, ~${tokens} tokens`);

    // Active tasks
    // (Scheduler listTasks is async, but we can provide what we know synchronously)
    parts.push(`- Model: ${this.llm.model()}`);
    parts.push(`- Auto mode: active`);

    if (this.planMode.isActive()) {
      parts.push(`- Plan mode: ${this.planMode.currentPhase()}`);
    }

    parts.push('');
    parts.push('Review the conversation context. If there are pending follow-ups, incomplete tasks, or anything that needs attention, take action. If nothing needs doing, respond briefly with your status.');

    return parts.join('\n');
  }

  private formatTrigger(trigger: import('../scheduler/types').TaskTrigger): string {
    switch (trigger.type) {
      case 'interval': {
        const sec = trigger.ms / 1000;
        if (sec >= 3600) return `every ${sec / 3600}h`;
        if (sec >= 60) return `every ${sec / 60}m`;
        return `every ${sec}s`;
      }
      case 'once': return `once @ ${new Date(trigger.at).toLocaleString()}`;
      case 'cron': return trigger.expression;
    }
  }

  setLLM(client: LLMClient): void {
    this.llm = client;
  }

  abort(): void {
    this.loop.abort();
  }

  private async tryDistill(userInput: string, response: string, turns: readonly Turn[]): Promise<void> {
    const proposal = await distillFromMessages(this.llm, userInput, response, turns);
    if (!proposal) return;

    // Dedup check
    const similar = this.skills.findSimilar(proposal.name, proposal.triggers, proposal.description);
    if (similar) {
      log.info('distill skipped — similar skill exists', { candidate: proposal.name, similar: similar.name, score: similar.score });
      return;
    }

    // Show proposal in chat
    const chatStore = (await import('../store/chatStore')).useChatStore;
    chatStore.getState().addDistillProposal(proposal);
  }

  async recoverCrashedSession(): Promise<void> {
    const turns = await this.sessionStore.recoverTurns();
    for (const t of turns) {
      // Use internal pushTurn via reflection or call addUserMessage/addAssistantMessage
      // For simplicity, we restore directly into context
      if (t.role === 'user') {
        this.context.addUserMessage(t.content.map(c => c.type === 'text' ? c.text : '').join(''));
      }
    }
    await this.sessionStore.start('browser', this.llm.model());
    for (const t of turns) {
      await this.sessionStore.appendTurn(t);
    }
  }

  async discardCrashedSession(): Promise<void> {
    await this.sessionStore.start('browser', this.llm.model());
  }

  private async handleSessionsCommand(args: string[]): Promise<{ response: string }> {
    const sub = args[0];
    const rest = args.slice(1).join(' ');

    switch (sub) {
      case 'list': case '': {
        const archived = await this.sessionStore.listArchived();
        if (archived.length === 0) return { response: t('sessions.empty') };
        const lines = archived.slice(0, 20).map(s =>
          `- **${s.id.slice(0, 16)}** | ${s.provider}:${s.model} | ${new Date(s.startedAt).toLocaleString()} | ${s.turnCount} turns`
        );
        if (archived.length > 20) lines.push(`... and ${archived.length - 20} more`);
        return { response: `${t('sessions.list')}:\n${lines.join('\n')}` };
      }
      case 'search': {
        if (!rest) return { response: t('sessions.searchUsage') };
        const results = this.sessionIndex.search(rest, 10);
        if (results.length === 0) return { response: t('sessions.noResults') + ': ' + rest };
        const lines = results.map(r =>
          `- [${r.sessionId.slice(0, 12)} turn#${r.turnIndex}] (${r.role}): ${r.snippet}`
        );
        return { response: `${t('sessions.search')} "${rest}":\n${lines.join('\n')}` };
      }
      case 'recall': {
        if (!rest) return { response: t('sessions.recallUsage') };
        const recall = this.sessionIndex.recallContext(rest, 1500);
        if (!recall) return { response: t('sessions.noResults') + ': ' + rest };
        return { response: recall };
      }
      case 'prune': {
        const days = parseInt(rest, 10) || 30;
        const pruned = await this.sessionStore.pruneArchived(days);
        return { response: `${t('sessions.pruned')}: ${pruned} (${days}d)` };
      }
      default:
        return { response: t('sessions.usage') };
    }
  }

  private handleMemoryCommand(args: string[]): { response: string } {
    const sub = args[0];
    const rest = args.slice(1).join(' ');

    switch (sub) {
      case 'list': case '': {
        const entries = this.memoryStore.list();
        if (entries.length === 0) return { response: t('memory.empty') };
        const lines = entries.map(e =>
          `- **#${e.id}** [${e.category}] ${e.timestamp.slice(0, 16)}: ${e.content}`
        );
        return { response: `${t('memory.list')} (${entries.length}):\n${lines.join('\n')}` };
      }
      case 'add': {
        if (!rest) return { response: t('memory.addUsage') };
        const categories: Array<'preference' | 'project' | 'decision' | 'fact'> = ['preference', 'project', 'decision', 'fact'];
        let category: 'preference' | 'project' | 'decision' | 'fact' = 'fact';
        let content = rest;
        const firstSpace = rest.indexOf(' ');
        if (firstSpace > 0) {
          const firstWord = rest.slice(0, firstSpace);
          if ((categories as string[]).includes(firstWord)) {
            category = firstWord as typeof category;
            content = rest.slice(firstSpace + 1);
          }
        }
        this.memoryStore.add(category, content).catch(() => {});
        const memCtx = this.memoryStore.recentContext(2000);
        this.promptBuilder.setMemoryContext(memCtx);
        return { response: `${t('memory.added')}: [${category}] ${content}` };
      }
      case 'remove': {
        const id = parseInt(args[1], 10);
        if (isNaN(id)) return { response: t('memory.removeUsage') };
        this.memoryStore.remove(id).catch(() => {});
        return { response: t('memory.removed') };
      }
      case 'clear': {
        this.memoryStore.clear().catch(() => {});
        this.promptBuilder.setMemoryContext('');
        return { response: t('memory.cleared') };
      }
      default:
        return { response: t('memory.usage') };
    }
  }

  destroy(): void {
    this.abort();
    this.scheduler.stop();
    this.skills.saveAll().catch(() => {});
    this.sessionStore.end().catch(() => {});
  }

  getScheduler(): Scheduler {
    return this.scheduler;
  }

  isAutoMode(): boolean {
    return this.autoMode;
  }

  getRuntime(): RuntimeProfile {
    return this.runtime;
  }

  private runtimeInfo(): string {
    const r = this.runtime;
    const caps = [...r.capabilities].sort();
    const tools = this.tools.list();
    const lines = [
      `# Runtime Environment`,
      ``,
      `**Type:** ${r.type}`,
      `**Platform:** ${r.mobile ? 'Mobile' : 'Desktop'}`,
      r.screen ? `**Screen:** ${r.screen.width}×${r.screen.height}` : '',
      r.memoryMB ? `**Memory:** ~${r.memoryMB} MB` : '',
      ``,
      `## Capabilities (${caps.length})`,
      ...caps.map(c => `- ${c}`),
      ``,
      `## Loaded Tools (${tools.length})`,
      ...tools.map(t => `- **${t.name}** [${t.permission}]`),
      ``,
      `## Limitations`,
      ...r.limitations.map(l => `- ${l}`),
    ].filter(Boolean);
    return lines.join('\n');
  }

  isRunning(): boolean {
    return this.running;
  }

  getToolRegistry(): ToolRegistry {
    return this.tools;
  }

  getSkillRegistry(): SkillRegistry {
    return this.skills;
  }

  getSessionStore(): SessionStore {
    return this.sessionStore;
  }

  getMemoryStore(): MemoryStore {
    return this.memoryStore;
  }

  private helpText(): string {
    return [
      t('cmd.help_title'),
      '',
      `- ${t('cmd.help_help')}`,
      `- ${t('cmd.help_clear')}`,
      `- ${t('cmd.help_status')}`,
      `- ${t('cmd.help_model')}`,
      `- ${t('cmd.help_plan')}`,
      `- ${t('cmd.help_next')}`,
      `- ${t('cmd.help_runtime')}`,
      `- ${t('cmd.help_schedule')}`,
      `- ${t('cmd.help_skill')}`,
      `- ${t('cmd.help_export')}`,
      `- ${t('cmd.help_auto')}`,
      '',
      t('cmd.help_footer'),
    ].join('\n');
  }
}
