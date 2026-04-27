// src/agent/SkillDistiller.ts — Auto-distill skills from conversation patterns

import type { LLMClient } from '../types/llm';
import type { Turn } from '../types/message';
import { logger } from '../lib/logger';

const log = logger.module('distiller');

export interface DistillProposal {
  name: string;
  description: string;
  triggers: string[];
  tools: string[];
  instructions: string;
  raw: string;
}

function isRetrievalQuery(input: string): boolean {
  const lower = input.toLowerCase();
  const questionPatterns = ['是什么', '什么是', '怎么样', '如何', '怎么', '多少',
    'what is', 'how to', 'how do', 'what are', '有哪些', '有没有', '在哪', '查一下'];
  const actionPatterns = ['修复', '实现', '重构', '优化', '添加', '创建',
    'fix', 'implement', 'refactor', 'create', 'build', '帮我写', '帮我改',
    '审查', 'review', '测试', 'test'];
  const hasQuestion = questionPatterns.some(p => lower.includes(p));
  const hasAction = actionPatterns.some(p => lower.includes(p));
  return hasQuestion && !hasAction;
}

function isEphemeralQuery(input: string): boolean {
  const lower = input.toLowerCase();
  const temporalTokens = ['今天', '现在', '最近', '明天', '本周',
    'today', 'now', 'current', 'latest', 'recent'];
  const ephemeralTopics = ['天气', '新闻', '热搜', '股价', '股票',
    'weather', 'news', 'headlines', 'stock', 'price'];
  return temporalTokens.some(t => lower.includes(t))
    && ephemeralTopics.some(t => lower.includes(t));
}

export function shouldDistill(input: string, totalToolCalls: number, successfulCalls: number): boolean {
  if (totalToolCalls < 5) return false;
  if (successfulCalls < totalToolCalls * 0.5) return false;
  if (input.length <= 10) return false;
  if (isRetrievalQuery(input)) return false;
  if (isEphemeralQuery(input)) return false;
  return true;
}

export function parseDistillOutput(text: string): DistillProposal | null {
  const fmMatch = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!fmMatch) return null;

  const fm = fmMatch[1];
  const body = fmMatch[2].trim();

  const fields = new Map<string, string>();
  for (const line of fm.split('\n')) {
    const colon = line.indexOf(':');
    if (colon > 0) {
      fields.set(line.slice(0, colon).trim(), line.slice(colon + 1).trim());
    }
  }

  const name = fields.get('name');
  if (!name) return null;

  const description = fields.get('description') || name;
  const triggers = (fields.get('trigger') || '').split(',').map(s => s.trim()).filter(Boolean);
  const toolsStr = fields.get('tools') || '[]';
  const tools = toolsStr.replace(/^\[|\]$/g, '').split(',').map(s => s.trim()).filter(Boolean);

  return { name, description, triggers, tools, instructions: body, raw: text };
}

function summarizeTurns(turns: readonly Turn[], maxChars = 3000): string {
  const lines: string[] = [];
  let remaining = maxChars;
  for (const t of turns) {
    const textParts: string[] = [];
    for (const c of t.content) {
      if (c.type === 'text') textParts.push(c.text);
      else if (c.type === 'tool_call') textParts.push(`[Call: ${c.name}]`);
      else if (c.type === 'tool_result') textParts.push(`[Result: ${c.content.slice(0, 100)}]`);
    }
    const line = `[${t.role}] ${textParts.join(' ')}`;
    if (line.length > remaining) break;
    remaining -= line.length;
    lines.push(line);
  }
  return lines.join('\n');
}

export async function distillFromMessages(
  llm: LLMClient,
  userInput: string,
  response: string,
  allTurns: readonly Turn[],
): Promise<DistillProposal | null> {
  const systemPrompt = '你是技能蒸馏专家。根据用户请求和执行结果，提取可复用模式，生成 SKILL.md。\n\n格式：\n---\nname: 英文小写连字符\ndescription: 中文简述\ntrigger: 词1, 词2\ntools: [tool1, tool2]\n---\n<body>\n\n去个性化，不含具体路径和时间。只输出 SKILL.md 内容，不要额外解释。';

  const summary = summarizeTurns(allTurns, 2000);
  const userPrompt = `用户请求：${userInput}\n\n执行结果摘要：\n${response.slice(0, 2000)}\n\n对话摘要：\n${summary}\n\n生成 SKILL.md。`;

  try {
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt },
    ];
    const result = await llm.complete({
      model: llm.model(),
      messages,
      tools: undefined,
      stream: false,
    });
    return parseDistillOutput(result.content);
  } catch (err: any) {
    log.warn('distillation failed', { error: err.message });
    return null;
  }
}
