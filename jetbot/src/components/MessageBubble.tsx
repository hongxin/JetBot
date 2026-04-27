import { useState } from 'react';
import type { UIMessage } from '../store/chatStore';
import { renderMarkdown } from '../lib/markdown';
import { DistillCard } from './DistillCard';
import { BrailleSpinner } from './shared/Spinner';

const SOURCE_LABEL: Record<string, { text: string; color: string }> = {
  scheduler: { text: 'Scheduled', color: 'bg-blue-500/20 text-blue-400' },
  heartbeat: { text: 'Heartbeat', color: 'bg-green-500/20 text-green-400' },
};

function SourceBadge({ source }: { source?: string }) {
  if (!source) return null;
  const label = SOURCE_LABEL[source];
  if (!label) return null;
  return (
    <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded-full font-medium mb-1 ${label.color}`}>
      {label.text}
    </span>
  );
}

/** Wind-fire wheel (风火轮) spinner — shown while the agent is thinking before content arrives. */
function ThinkingSpinner() {
  return (
    <div className="flex items-center gap-2 py-1">
      <svg
        className="animate-spin"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        style={{ animationDuration: '1.2s' }}
      >
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.15" strokeWidth="2.5" />
        <path
          d="M12 2a10 10 0 0 1 8.66 5"
          stroke="url(#fire1)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M12 22a10 10 0 0 1-8.66-5"
          stroke="url(#fire2)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="fire1" x1="12" y1="2" x2="20.66" y2="7">
            <stop stopColor="#f97316" />
            <stop offset="1" stopColor="#eab308" />
          </linearGradient>
          <linearGradient id="fire2" x1="12" y1="22" x2="3.34" y2="17">
            <stop stopColor="#ef4444" />
            <stop offset="1" stopColor="#f97316" />
          </linearGradient>
        </defs>
      </svg>
      <span className="text-xs text-[hsl(var(--muted-foreground))] animate-pulse">
        Thinking...
      </span>
    </div>
  );
}

interface Props {
  message: UIMessage;
}

function ReasoningBlock({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="mb-2 border border-purple-500/20 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-purple-400 bg-purple-500/10 hover:bg-purple-500/15 transition-colors"
      >
        <svg
          className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
        <span className="font-medium">Reasoning</span>
      </button>
      {expanded && (
        <div className="px-3 py-2 text-xs text-[hsl(var(--muted-foreground))] bg-purple-500/5 max-h-60 overflow-y-auto whitespace-pre-wrap">
          {content}
        </div>
      )}
    </div>
  );
}

export function MessageBubble({ message }: Props) {
  if (message.role === 'error') {
    return (
      <div className="bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 rounded-xl px-4 py-3 text-sm">
        {message.content}
      </div>
    );
  }

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%]">
          <div className="flex justify-end">
            <SourceBadge source={message.source} />
          </div>
          <div className="bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-2xl px-4 py-2.5 whitespace-pre-wrap text-sm">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  // Assistant — show spinner when streaming with no content yet, cursor when streaming with content
  const isThinking = message.isStreaming && !message.content && !message.reasoningContent;
  const isStreamingContent = message.isStreaming && !!message.content;

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%]">
        <SourceBadge source={message.source} />
        <div className="bg-[hsl(var(--muted))] rounded-2xl px-4 py-3 text-sm prose prose-sm dark:prose-invert max-w-none">
          {isThinking ? (
            <ThinkingSpinner />
          ) : (
            <>
              {message.reasoningContent && (
                <ReasoningBlock content={message.reasoningContent} />
              )}
              <div dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }} />
              {isStreamingContent && (
                <BrailleSpinner className="inline-block ml-1 text-[hsl(var(--muted-foreground))]" />
              )}
            </>
          )}
        </div>
        {message.distillProposal && (
          <DistillCard
            proposal={message.distillProposal}
            onSave={() => {
              const event = new CustomEvent('jetbot:distill:save', {
                detail: { msgId: message.id, proposal: message.distillProposal },
              });
              document.dispatchEvent(event);
            }}
            onDiscard={() => {
              const event = new CustomEvent('jetbot:distill:discard', {
                detail: { msgId: message.id },
              });
              document.dispatchEvent(event);
            }}
          />
        )}
      </div>
    </div>
  );
}
