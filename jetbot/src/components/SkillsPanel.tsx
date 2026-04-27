import { useState, useCallback } from 'react';
import { useAgentStore } from '../store/agentStore';
import { useT } from '../lib/i18n';
import type { Skill, LifecycleStage } from '../skills/types';

const STAGE_STYLE: Record<LifecycleStage, { dot: string; bg: string }> = {
  new:     { dot: 'bg-blue-400',    bg: 'bg-blue-500/10' },
  active:  { dot: 'bg-green-400',   bg: 'bg-green-500/10' },
  stable:  { dot: 'bg-amber-400',   bg: 'bg-amber-500/10' },
  stale:   { dot: 'bg-orange-400',  bg: 'bg-orange-500/10' },
  deprecated: { dot: 'bg-gray-400', bg: 'bg-gray-500/10' },
};

const STAGE_LABEL: Record<LifecycleStage, string> = {
  new: 'New', active: 'Active', stable: 'Stable', stale: 'Stale', deprecated: 'Deprecated',
};

function SkillRow({ skill, onActivate, onDeactivate, onExport, onDelete }: {
  skill: Skill & { active: boolean };
  onActivate: (n: string) => void;
  onDeactivate: () => void;
  onExport: (n: string) => void;
  onDelete: (n: string) => void;
}) {
  const t = useT();
  const style = STAGE_STYLE[skill.lifecycleStage] || STAGE_STYLE.new;

  return (
    <div className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border ${
      skill.active ? 'border-[hsl(var(--ring))] bg-[hsl(var(--accent))/10]' : 'border-[hsl(var(--border))]'
    }`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm text-[hsl(var(--foreground))]">{skill.name}</span>
          {skill.active && <span className="text-[10px] px-1 rounded bg-[hsl(var(--ring))/20] text-[hsl(var(--ring))]">active</span>}
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${style.bg} flex items-center gap-1`}>
            <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
            {STAGE_LABEL[skill.lifecycleStage]}
          </span>
        </div>
        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 truncate">{skill.description}</p>
        <div className="flex items-center gap-2 mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">
          <span>Used: {skill.useCount}</span>
          <span>Score: {(skill.qualityScore * 100).toFixed(0)}%</span>
          {skill.trigger && <span className="truncate max-w-[160px]">Triggers: {skill.trigger}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {skill.active ? (
          <button onClick={onDeactivate} className="px-2 py-1 text-[10px] rounded border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">Deactivate</button>
        ) : (
          <button onClick={() => onActivate(skill.name)} className="px-2 py-1 text-[10px] rounded bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90">Activate</button>
        )}
        <button onClick={() => onExport(skill.name)} className="px-2 py-1 text-[10px] rounded border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">{t('skills.panel.export')}</button>
        {!skill.originManual && (
          <button onClick={() => onDelete(skill.name)} className="px-2 py-1 text-[10px] rounded border border-red-500/30 hover:bg-red-500/10 text-red-400">{t('skills.panel.delete')}</button>
        )}
      </div>
    </div>
  );
}

export function SkillsPanel() {
  const t = useT();
  const agent = useAgentStore(s => s.agent);
  const [importText, setImportText] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const registry = agent?.getSkillRegistry();
  const skills = registry ? registry.list().map(s => {
    const full = registry.get(s.name)!;
    return { ...full, active: s.active };
  }) : [];

  const handleActivate = useCallback((name: string) => {
    registry?.activate(name);
    setRefreshKey(k => k + 1);
  }, [registry]);

  const handleDeactivate = useCallback(() => {
    registry?.deactivate();
    setRefreshKey(k => k + 1);
  }, [registry]);

  const handleExport = useCallback((name: string) => {
    const content = registry?.exportSkill(name);
    if (!content) return;
    document.dispatchEvent(new CustomEvent('jetbot:export', {
      detail: { content, filename: `${name}.SKILL.md`, path: `/${name}.SKILL.md` },
    }));
  }, [registry]);

  const handleDelete = useCallback((name: string) => {
    registry?.remove(name);
    setRefreshKey(k => k + 1);
  }, [registry]);

  const handleImport = useCallback(() => {
    if (!importText.trim()) return;
    const result = registry?.importSkill(importText.trim());
    if (result) {
      setImportStatus(`Imported: ${result.name}`);
      setImportText('');
      setRefreshKey(k => k + 1);
    } else {
      setImportStatus('Invalid SKILL.md format');
    }
    setTimeout(() => setImportStatus(null), 3000);
  }, [importText, registry]);

  const sortedSkills = [...skills].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-3" key={refreshKey}>
      {sortedSkills.length === 0 ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-4">{t('skills.panel.noSkills')}</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {sortedSkills.map(s => (
            <SkillRow key={s.name} skill={s} onActivate={handleActivate} onDeactivate={handleDeactivate} onExport={handleExport} onDelete={handleDelete} />
          ))}
        </div>
      )}

      <div className="border-t border-[hsl(var(--border))] pt-3">
        <label className="text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1 block">{t('skills.panel.import')}</label>
        <textarea
          value={importText}
          onChange={e => setImportText(e.target.value)}
          className="w-full h-20 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] resize-none font-mono"
          placeholder={t('skills.panel.paste')}
        />
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={handleImport}
            className="px-3 py-1.5 text-xs rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90"
          >
            {t('skills.panel.importBtn')}
          </button>
          {importStatus && (
            <span className={`text-xs ${importStatus.startsWith('Imported') ? 'text-green-400' : 'text-red-400'}`}>
              {importStatus}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
