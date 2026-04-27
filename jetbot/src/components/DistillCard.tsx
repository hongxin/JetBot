import type { DistillProposal } from '../agent/SkillDistiller';

interface Props {
  proposal: DistillProposal;
  onSave: () => void;
  onDiscard: () => void;
  resolved?: boolean;
}

export function DistillCard({ proposal, onSave, onDiscard, resolved }: Props) {
  return (
    <div className="mt-3 border border-orange-500/30 bg-orange-500/5 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-orange-500/15 flex items-center gap-2">
        <span className="text-base">提炼出新 Skill</span>
      </div>
      <div className="px-4 py-3 space-y-2 text-sm">
        <div className="flex gap-2">
          <span className="text-[hsl(var(--muted-foreground))] min-w-[4rem]">{'名称:'}</span>
          <span className="text-[hsl(var(--foreground))] font-mono">{proposal.name}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-[hsl(var(--muted-foreground))] min-w-[4rem]">{'描述:'}</span>
          <span className="text-[hsl(var(--foreground))]">{proposal.description}</span>
        </div>
        {proposal.triggers.length > 0 && (
          <div className="flex gap-2">
            <span className="text-[hsl(var(--muted-foreground))] min-w-[4rem]">{'触发词:'}</span>
            <span className="text-[hsl(var(--foreground))]">
              {proposal.triggers.map(t => (
                <code key={t} className="mr-1 px-1.5 py-0.5 rounded bg-[hsl(var(--muted))] text-xs">{t}</code>
              ))}
            </span>
          </div>
        )}
        {proposal.tools.length > 0 && (
          <div className="flex gap-2">
            <span className="text-[hsl(var(--muted-foreground))] min-w-[4rem]">{'工具:'}</span>
            <span className="text-[hsl(var(--foreground))]">
              {proposal.tools.map(t => (
                <code key={t} className="mr-1 px-1.5 py-0.5 rounded bg-[hsl(var(--muted))] text-xs">{t}</code>
              ))}
            </span>
          </div>
        )}
      </div>
      {!resolved && (
        <div className="px-4 py-2.5 border-t border-orange-500/15 flex gap-2">
          <button
            onClick={onSave}
            className="px-4 py-1.5 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 text-sm font-medium transition-colors"
          >
            {'保存'}
          </button>
          <button
            onClick={onDiscard}
            className="px-4 py-1.5 rounded-lg bg-[hsl(var(--muted))] hover:bg-[hsl(var(--muted-foreground))/20] text-[hsl(var(--muted-foreground))] text-sm transition-colors"
          >
            {'舍弃'}
          </button>
        </div>
      )}
    </div>
  );
}
