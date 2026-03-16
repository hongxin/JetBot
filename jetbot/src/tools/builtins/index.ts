import type { ToolRegistry } from '../ToolRegistry';
import { createReadFile } from './readFile';
import { createWriteFile } from './writeFile';
import { createEditFile } from './editFile';
import { createListDir } from './listDir';
import { createSearchText } from './searchText';
import { createHttpGet } from './httpGet';
import { createShellExecute } from './shellExecute';
import { createJsEval } from './jsEval';
import { createRenderHtml } from './renderHtml';
import { createExportFile } from './exportFile';

export function registerBuiltins(registry: ToolRegistry): void {
  const fs = registry.fs;

  // Virtual filesystem tools (always available)
  registry.register(createReadFile(fs));
  registry.register(createWriteFile(fs));
  registry.register(createEditFile(fs));
  registry.register(createListDir(fs));
  registry.register(createSearchText(fs));
  registry.register(createShellExecute(fs));

  // Network
  registry.register(createHttpGet());

  // Browser-native tools (loaded only if capabilities are present)
  registry.register(createJsEval());
  registry.register(createRenderHtml());
  registry.register(createExportFile(fs));
}
