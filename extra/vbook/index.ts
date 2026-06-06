import * as path from 'path';
import * as fs from 'fs';
import { convertPlugin } from './converter';

async function main() {
  const inputDir = process.argv[2];
  const outputDir = process.argv[3] || path.join(process.cwd(), 'plugins');

  if (!inputDir) {
    console.error(
      'Usage: npx tsx extra/vbook/index.ts <input_vbook_dir> [output_lnreader_dir]',
    );
    process.exit(1);
  }

  const pluginJsonPath = path.join(inputDir, 'plugin.json');
  if (!fs.existsSync(pluginJsonPath)) {
    console.error(`Missing plugin.json in: ${inputDir}`);
    process.exit(1);
  }

  try {
    const config = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf-8'));
    console.log(`Converting plugin: ${config.metadata.name}...`);

    await convertPlugin(inputDir, outputDir, config);

    console.log(`Successfully converted ${config.metadata.name}`);
  } catch (err: any) {
    console.error('Conversion failed:', err.message);
  }
}

main().catch(console.error);
