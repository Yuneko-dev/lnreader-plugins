import * as fs from 'fs';
import * as path from 'path';
import { handleNovelPlugin } from './handlers/novel';
import { handleVideoPlugin } from './handlers/video';

export async function convertPlugin(
  inputDir: string,
  outputDir: string,
  config: any,
) {
  const type = config.metadata.type;
  const folderName = path.basename(path.resolve(inputDir));

  let id = `vbook.${config.metadata.author || 'unknown'}.${folderName}`;
  id = id.toLowerCase().replace(/[^a-z0-9_.-]/g, '');

  const pluginName = `[vBook] ${config.metadata.name}`;
  const outPluginDir = path.join(outputDir, 'multi', `vbook_${folderName}`);
  if (!fs.existsSync(outPluginDir))
    fs.mkdirSync(outPluginDir, { recursive: true });

  let finalCode = '';
  if (type === 'novel' || type === 'chinese_novel') {
    finalCode = await handleNovelPlugin(
      inputDir,
      config,
      id,
      pluginName,
      folderName,
    );
  } else if (type === 'video') {
    finalCode = await handleVideoPlugin(
      inputDir,
      config,
      id,
      pluginName,
      folderName,
    );

    const webviewDir = path.join(outPluginDir, 'webview');
    if (!fs.existsSync(webviewDir))
      fs.mkdirSync(webviewDir, { recursive: true });

    const templateIndexJsPath = path.join(
      process.cwd(),
      'extra/vbook/templates/webview/index.js',
    );
    if (fs.existsSync(templateIndexJsPath)) {
      fs.copyFileSync(templateIndexJsPath, path.join(webviewDir, 'index.js'));
    }
  } else {
    throw new Error(`Unsupported plugin type: ${type}`);
  }

  fs.writeFileSync(path.join(outPluginDir, 'index.ts'), finalCode);
  // public/static/src/multi
  const publicPluginDir = path.join(
    process.cwd(),
    'public',
    'static',
    'src',
    'multi',
    `vbook_${folderName}`,
  );
  if (!fs.existsSync(publicPluginDir))
    fs.mkdirSync(publicPluginDir, { recursive: true });

  const iconPath = path.join(inputDir, 'icon.png');
  if (fs.existsSync(iconPath)) {
    fs.copyFileSync(iconPath, path.join(publicPluginDir, 'icon.png'));
  }
  const jsPath = path.join(outPluginDir, 'webview', 'index.js');
  if (fs.existsSync(jsPath)) {
    fs.copyFileSync(jsPath, path.join(publicPluginDir, 'index.js'));
  }
}
