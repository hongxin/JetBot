import { useCallback } from 'react';
import { useConfigStore } from '../store/configStore';

export type Locale = 'en' | 'zh';

const translations = {
  // WelcomeScreen
  'welcome.subtitle': {
    en: 'Browser-based AI coding assistant.\nZero install. Zero deploy. Zero config.',
    zh: '浏览器端 AI 编程助手。\n零安装、零部署、零配置。',
  },
  'welcome.provider': { en: 'Provider', zh: '服务商' },
  'welcome.apiKey': { en: 'API Key', zh: 'API 密钥' },
  'welcome.apiKeyHint': {
    en: 'Your key is stored locally and never sent to our servers.',
    zh: '密钥仅保存在本地，不会发送到我们的服务器。',
  },
  'welcome.baseUrl': { en: 'Base URL', zh: '接口地址' },
  'welcome.model': { en: 'Model', zh: '模型' },
  'welcome.start': { en: 'Get Started', zh: '开始使用' },
  'welcome.show': { en: 'Show', zh: '显示' },
  'welcome.hide': { en: 'Hide', zh: '隐藏' },
  'welcome.ollamaHint': {
    en: 'Ollama runs locally — no API key needed. Make sure Ollama is running on your machine.',
    zh: 'Ollama 在本地运行，无需 API 密钥。请确保 Ollama 已在本机启动。',
  },

  // StatusBar
  'status.ready': { en: 'Ready', zh: '就绪' },
  'status.thinking': { en: 'Thinking...', zh: '思考中...' },
  'status.executing_tool': { en: 'Running tool...', zh: '执行工具中...' },
  'status.waiting_permission': { en: 'Awaiting permission', zh: '等待授权' },
  'status.error': { en: 'Error', zh: '错误' },
  'status.settings': { en: 'Settings', zh: '设置' },

  // InputBar
  'input.placeholder': { en: 'Type a message...', zh: '输入消息...' },
  'input.thinking': { en: 'Thinking...', zh: '思考中...' },
  'input.send': { en: 'Send', zh: '发送' },
  'input.stop': { en: 'Stop', zh: '停止' },

  // ChatPanel
  'chat.empty': { en: 'Send a message to get started', zh: '发送消息开始对话' },

  // PermissionDialog
  'permission.title': { en: 'Permission Request', zh: '权限请求' },
  'permission.allow_tool': { en: 'Allow tool', zh: '允许工具' },
  'permission.allow': { en: 'Allow (Y)', zh: '允许 (Y)' },
  'permission.deny': { en: 'Deny (N)', zh: '拒绝 (N)' },
  'permission.always': { en: 'Always (A)', zh: '始终允许 (A)' },
  'permission.always_hint': { en: 'Allow this tool for the rest of this session', zh: '本次会话内始终允许此工具' },

  // SettingsDialog
  'settings.title': { en: 'Settings', zh: '设置' },
  'settings.provider': { en: 'Provider', zh: '服务商' },
  'settings.apiKey': { en: 'API Key', zh: 'API 密钥' },
  'settings.model': { en: 'Model', zh: '模型' },
  'settings.baseUrl': { en: 'Base URL', zh: '接口地址' },
  'settings.proxyUrl': { en: 'CORS Proxy URL (optional)', zh: 'CORS 代理地址（可选）' },
  'settings.cancel': { en: 'Cancel', zh: '取消' },
  'settings.save': { en: 'Save', zh: '保存' },
  'settings.language': { en: 'Language', zh: '语言' },

  // Validation
  'validate.apiKey': { en: 'API Key is required', zh: 'API 密钥不能为空' },
  'validate.baseUrl': { en: 'Base URL is required', zh: '接口地址不能为空' },
  'validate.model': { en: 'Model is required', zh: '模型不能为空' },

  // Agent commands
  'cmd.cleared': { en: 'Conversation cleared.', zh: '对话已清除。' },
  'cmd.plan_deactivated': { en: 'Plan mode deactivated.', zh: '计划模式已关闭。' },
  'cmd.plan_usage': { en: 'Usage: /plan <goal> — Enter plan mode with a goal.', zh: '用法：/plan <目标> — 输入目标进入计划模式。' },
  'cmd.plan_activated': { en: 'Plan mode activated.', zh: '计划模式已激活。' },
  'cmd.goal': { en: 'Goal', zh: '目标' },
  'cmd.phase': { en: 'Phase', zh: '阶段' },
  'cmd.use_next': { en: 'Use /next to advance phases.', zh: '使用 /next 推进阶段。' },
  'cmd.not_in_plan': { en: 'Not in plan mode. Use /plan <goal> first.', zh: '未处于计划模式。请先使用 /plan <目标>。' },
  'cmd.advanced_to': { en: 'Advanced to phase', zh: '已推进到阶段' },
  'cmd.unknown': { en: 'Unknown command', zh: '未知命令' },
  'cmd.type_help': { en: 'Type /help for available commands.', zh: '输入 /help 查看可用命令。' },
  'cmd.help_title': { en: '# JetBot Commands', zh: '# JetBot 命令' },
  'cmd.help_help': { en: '`/help` — Show this help', zh: '`/help` — 显示帮助' },
  'cmd.help_clear': { en: '`/clear` — Clear conversation history', zh: '`/clear` — 清除对话历史' },
  'cmd.help_status': { en: '`/status` — Show current status', zh: '`/status` — 显示当前状态' },
  'cmd.help_model': { en: '`/model` — Show current model', zh: '`/model` — 显示当前模型' },
  'cmd.help_plan': { en: '`/plan <goal>` — Enter/exit plan mode', zh: '`/plan <目标>` — 进入/退出计划模式' },
  'cmd.help_next': { en: '`/next` — Advance plan mode phase', zh: '`/next` — 推进计划阶段' },
  'cmd.help_skill': { en: '`/skill <name>|off|list` — Activate/deactivate skills', zh: '`/skill <名称>|off|list` — 激活/关闭技能' },
  'cmd.help_footer': { en: 'Just type naturally to chat with the AI assistant.', zh: '直接输入自然语言与 AI 助手对话。' },
  'cmd.help_runtime': { en: '`/runtime` — Show detected runtime environment and capabilities', zh: '`/runtime` — 显示检测到的运行时环境和能力' },
  'cmd.help_schedule': { en: '`/schedule list|add|remove|pause|resume` — Manage scheduled tasks', zh: '`/schedule list|add|remove|pause|resume` — 管理定时任务' },
  'cmd.help_export': { en: '`/export <path>` — Download a VirtualFS file to local filesystem', zh: '`/export <路径>` — 从虚拟文件系统下载文件到本地' },
  'cmd.help_auto': { en: '`/auto on|off` — Toggle autonomous mode (heartbeat)', zh: '`/auto on|off` — 切换自主模式（心跳）' },

  // Schedule
  'schedule.title': { en: 'Scheduled Tasks', zh: '定时任务' },
  'schedule.list': { en: 'Scheduled tasks', zh: '定时任务列表' },
  'schedule.empty': { en: 'No scheduled tasks.', zh: '暂无定时任务。' },
  'schedule.name': { en: 'Name', zh: '名称' },
  'schedule.trigger': { en: 'Trigger', zh: '触发规则' },
  'schedule.status': { en: 'Status', zh: '状态' },
  'schedule.lastRun': { en: 'Last Run', zh: '上次运行' },
  'schedule.pause': { en: 'Pause', zh: '暂停' },
  'schedule.resume': { en: 'Resume', zh: '恢复' },
  'schedule.added': { en: 'Task added', zh: '任务已添加' },
  'schedule.removed': { en: 'Task removed.', zh: '任务已删除。' },
  'schedule.paused': { en: 'Task paused.', zh: '任务已暂停。' },
  'schedule.resumed': { en: 'Task resumed.', zh: '任务已恢复。' },
  'schedule.notFound': { en: 'Task not found.', zh: '未找到该任务。' },
  'schedule.usage': { en: 'Usage: /schedule list | add <name> <trigger> <prompt> | remove <id> | pause <id> | resume <id>', zh: '用法：/schedule list | add <名称> <触发规则> <提示词> | remove <id> | pause <id> | resume <id>' },
  'schedule.addUsage': { en: 'Usage: /schedule add <name> <trigger> <prompt>', zh: '用法：/schedule add <名称> <触发规则> <提示词>' },

  // Auto mode
  'auto.on': { en: 'Autonomous mode ON. Risky tools auto-approved; dangerous tools prompt once then remembered. Heartbeat every 5 min.', zh: '自主模式已开启。风险工具自动批准，危险工具首次确认后记忆。每 5 分钟心跳。' },
  'auto.off': { en: 'Autonomous mode OFF. Standard permission prompts restored.', zh: '自主模式已关闭。恢复标准权限确认。' },

  // Skills
  'skill.activated': { en: 'Skill activated', zh: '技能已激活' },
  'skill.deactivated': { en: 'Skill deactivated.', zh: '技能已关闭。' },
  'skill.notFound': { en: 'Skill not found', zh: '未找到该技能' },
  'skill.noActive': { en: 'No active skill.', zh: '当前无激活技能。' },
  'skill.usage': { en: 'Usage: /skill <name> | /skill off | /skill list', zh: '用法：/skill <名称> | /skill off | /skill list' },
  'skill.list': { en: 'Available skills', zh: '可用技能' },

  // Log panel
  'log.title': { en: 'System Logs', zh: '系统日志' },
  'log.allModules': { en: 'All modules', zh: '全部模块' },
  'log.autoScroll': { en: 'Auto-scroll', zh: '自动滚动' },
  'log.clear': { en: 'Clear', zh: '清除' },
  'log.empty': { en: 'No log entries.', zh: '暂无日志。' },
  'log.entries': { en: 'entries', zh: '条' },
  'log.modules': { en: 'modules', zh: '个模块' },
  'status.logs': { en: 'Logs', zh: '日志' },
} as const;

export type TranslationKey = keyof typeof translations;

let currentLocale: Locale = 'en';

export function setLocale(locale: Locale): void {
  currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

export function t(key: TranslationKey): string {
  const entry = translations[key];
  return entry?.[currentLocale] ?? entry?.en ?? key;
}

// React hook — components call useT() to get a `t` function that
// triggers a re-render whenever the configStore locale changes.
export function useT() {
  const locale = useConfigStore(s => s.locale);
  // Return a new function reference when locale changes so React re-renders.
  return useCallback(
    (key: TranslationKey): string => {
      const entry = translations[key];
      return entry?.[locale] ?? entry?.en ?? key;
    },
    [locale],
  );
}
