import { useEffect, useRef, useCallback } from 'react';
import { useAgentStore } from '../store/agentStore';
import { useChatStore } from '../store/chatStore';

/**
 * ExportListener — listens for 'jetbot:export' events from the export_file tool
 * and triggers a browser download.
 */
export function ExportListener() {
  useEffect(() => {
    const handler = (e: Event) => {
      const { content, filename } = (e as CustomEvent).detail;
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };
    document.addEventListener('jetbot:export', handler);
    return () => document.removeEventListener('jetbot:export', handler);
  }, []);
  return null;
}

/**
 * ImportButton — file picker button that imports files into VirtualFS.
 * Renders as a small upload icon button next to the input bar.
 */
export function ImportButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const agent = useAgentStore(s => s.agent);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || !agent) return;
    const fs = agent.getToolRegistry().fs;
    await fs.init();

    const imported: string[] = [];
    for (const file of Array.from(files)) {
      const text = await file.text();
      const path = `/workspace/${file.name}`;
      await fs.writeFile(path, text);
      imported.push(path);
    }

    if (imported.length > 0) {
      const chat = useChatStore.getState();
      const id = chat.addAssistantMessage();
      const msg = imported.length === 1
        ? `Imported **${imported[0]}** (${files[0].size} bytes) into VirtualFS.`
        : `Imported ${imported.length} files into VirtualFS:\n${imported.map(p => `- ${p}`).join('\n')}`;
      chat.appendToAssistant(id, msg);
      chat.finalizeAssistant(id);
    }
  }, [agent]);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={e => { handleFiles(e.target.files); e.target.value = ''; }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        title="Import files into VirtualFS"
        className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 py-2.5 text-sm hover:bg-[hsl(var(--muted))] transition-colors shrink-0"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      </button>
    </>
  );
}

/**
 * DropZone wrapper — wraps children and handles drag-and-drop file import.
 */
export function DropZone({ children, className }: { children: React.ReactNode; className?: string }) {
  const agent = useAgentStore(s => s.agent);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).classList.remove('ring-2', 'ring-[hsl(var(--primary))]');

    if (!agent) return;
    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    const fs = agent.getToolRegistry().fs;
    await fs.init();

    const imported: string[] = [];
    for (const file of Array.from(files)) {
      const text = await file.text();
      const path = `/workspace/${file.name}`;
      await fs.writeFile(path, text);
      imported.push(path);
    }

    if (imported.length > 0) {
      const chat = useChatStore.getState();
      const id = chat.addAssistantMessage();
      const msg = imported.length === 1
        ? `Imported **${imported[0]}** (${files[0].size} bytes) into VirtualFS.`
        : `Imported ${imported.length} files into VirtualFS:\n${imported.map(p => `- ${p}`).join('\n')}`;
      chat.appendToAssistant(id, msg);
      chat.finalizeAssistant(id);
    }
  }, [agent]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).classList.add('ring-2', 'ring-[hsl(var(--primary))]');
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).classList.remove('ring-2', 'ring-[hsl(var(--primary))]');
  }, []);

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`flex flex-col min-h-0 min-w-0 transition-all duration-150 ${className ?? 'flex-1'}`}
    >
      {children}
    </div>
  );
}
