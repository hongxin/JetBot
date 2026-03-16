import { useConfigStore } from './store/configStore';
import { useAgentStore } from './store/agentStore';
import { WelcomeScreen } from './components/WelcomeScreen';
import { ChatPanel } from './components/ChatPanel';
import { InputBar } from './components/InputBar';
import { StatusBar } from './components/StatusBar';
import { PermissionDialog } from './components/PermissionDialog';
import { RenderPreviewListener, PreviewPanel, usePreviews } from './components/RenderPreview';
import { ExportListener, DropZone } from './components/FileBridge';

export default function App() {
  const isConfigured = useConfigStore(s => s.validate().valid);
  const agent = useAgentStore(s => s.agent);
  const previews = usePreviews();
  const hasPreviews = previews.length > 0;

  if (!isConfigured || !agent) {
    return (
      <div className="flex flex-col h-dvh bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
        <WelcomeScreen />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-dvh bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <StatusBar />

      {/* Main content area: chat (+ optional right-side preview panel) */}
      <div className={`flex flex-1 min-h-0 ${hasPreviews ? '' : ''}`}>
        {/* Left: Chat + Input — wrapped in DropZone for file import */}
        <DropZone className={hasPreviews ? 'w-[45%] min-w-[320px]' : 'flex-1'}>
          <ChatPanel />
          <InputBar />
        </DropZone>

        {/* Right: Preview panel — only when previews exist */}
        {hasPreviews && (
          <div className="flex-1 min-w-[360px]">
            <PreviewPanel />
          </div>
        )}
      </div>

      <RenderPreviewListener />
      <ExportListener />
      <PermissionDialog />
    </div>
  );
}
