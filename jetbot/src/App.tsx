import { useConfigStore } from './store/configStore';
import { useAgentStore } from './store/agentStore';
import { useCosmosStore } from './store/cosmosStore';
import { WelcomeScreen } from './components/WelcomeScreen';
import { ChatPanel } from './components/ChatPanel';
import { InputBar } from './components/InputBar';
import { StatusBar } from './components/StatusBar';
import { PermissionDialog } from './components/PermissionDialog';
import { RenderPreviewListener, PreviewPanel, usePreviews } from './components/RenderPreview';
import { ExportListener, DropZone } from './components/FileBridge';
import { CosmosView } from './components/cosmos/CosmosView';

export default function App() {
  const isConfigured = useConfigStore(s => s.validate().valid);
  const agent = useAgentStore(s => s.agent);
  const activeView = useCosmosStore(s => s.activeView);
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

      {/* Main content area */}
      <div className={`flex flex-1 min-h-0`}>
        {activeView === 'chat' ? (
          <>
            <DropZone className={hasPreviews ? 'w-[45%] min-w-[320px]' : 'flex-1'}>
              <ChatPanel />
              <InputBar />
            </DropZone>
            {hasPreviews && (
              <div className="flex-1 min-w-[360px]">
                <PreviewPanel />
              </div>
            )}
          </>
        ) : (
          <>
            <CosmosView />
            {hasPreviews && (
              <div className="w-[45%] min-w-[360px]">
                <PreviewPanel />
              </div>
            )}
          </>
        )}
      </div>

      <RenderPreviewListener />
      <ExportListener />
      <PermissionDialog />
    </div>
  );
}
