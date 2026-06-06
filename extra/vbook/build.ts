import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { convertPlugin } from './converter';

async function buildRepo(repoDir: string, shouldClean: boolean) {
  if (shouldClean) {
    console.log(
      `[INFO] Đang xoá thư mục plugins/multi/vbook_* và public/static/src/multi/vbook_* ...`,
    );
    const pluginsDir = path.join(process.cwd(), 'plugins', 'multi');
    const publicDir = path.join(
      process.cwd(),
      'public',
      'static',
      'src',
      'multi',
    );

    [pluginsDir, publicDir].forEach(dir => {
      if (fs.existsSync(dir)) {
        fs.readdirSync(dir).forEach(file => {
          if (file.startsWith('vbook_')) {
            fs.rmSync(path.join(dir, file), { recursive: true, force: true });
          }
        });
      }
    });
  }

  const pluginJsonPath = path.join(repoDir, 'plugin.json');
  if (!fs.existsSync(pluginJsonPath)) {
    console.error(`Không tìm thấy file plugin.json tại ${repoDir}`);
    process.exit(1);
  }

  let repoData;
  try {
    repoData = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf-8'));
  } catch (e) {
    console.error(`Lỗi đọc file plugin.json: ${(e as any).message}`);
    process.exit(1);
  }

  if (!repoData.data || !Array.isArray(repoData.data)) {
    console.error("Cấu trúc plugin.json không hợp lệ. Thiếu mảng 'data'.");
    process.exit(1);
  }

  console.log(
    `Bắt đầu build repo của tác giả: ${repoData.metadata?.author || 'Unknown'}`,
  );
  console.log(`Mô tả: ${repoData.metadata?.description || ''}\n`);

  for (const item of repoData.data) {
    if (
      item.type !== 'novel' &&
      item.type !== 'chinese_novel' &&
      item.type !== 'video'
    ) {
      console.log(
        `[BỎ QUA] Plugin ${item.name || 'Unknown'} thuộc loại '${item.type}' chưa được hỗ trợ.`,
      );
      continue;
    }

    const itemPathUrl = item.path;
    if (!itemPathUrl) continue;

    // Trích xuất phần đường dẫn từ chuỗi URL
    // VD: https://.../extensions/novel/kychi_vivutruyen/plugin.zip -> extensions/novel/kychi_vivutruyen
    const match = itemPathUrl.match(/(extensions\/.*?)\/plugin\.zip/);

    if (match && match[1]) {
      const relPath = match[1];
      const pluginDir = path.join(repoDir, relPath);

      console.log(`\n----------------------------------------`);
      console.log(`Đang xử lý: ${item.name}`);
      console.log(`Đường dẫn con: ${relPath}`);

      if (fs.existsSync(pluginDir)) {
        try {
          const pluginConfigPath = path.join(pluginDir, 'plugin.json');
          const srcDir = path.join(pluginDir, 'src');
          const zipPath = path.join(pluginDir, 'plugin.zip');

          // Giải nén plugin.zip nếu không có thư mục src
          if (!fs.existsSync(srcDir) && fs.existsSync(zipPath)) {
            console.log(
              `[INFO] Đang giải nén plugin.zip cho ${item.name || 'Unknown'}...`,
            );
            try {
              execSync('tar -xf plugin.zip', { cwd: pluginDir });
            } catch (err) {
              console.error(
                `[LỖI] Không thể giải nén plugin.zip cho ${item.name}: ${(err as any).message}`,
              );
            }
          }

          if (!fs.existsSync(pluginConfigPath)) {
            console.error(`[LỖI] Thiếu plugin.json tại: ${pluginDir}`);
            continue;
          }
          const pluginConfig = JSON.parse(
            fs.readFileSync(pluginConfigPath, 'utf-8'),
          );

          if (pluginConfig.metadata?.encrypt) {
            console.error(
              `[BỎ QUA] Plugin ${item.name || 'Unknown'} bị mã hoá (metadata.encrypt) - Không hỗ trợ convert.`,
            );
            continue;
          }

          const outputDir = path.join(process.cwd(), 'plugins');
          await convertPlugin(pluginDir, outputDir, pluginConfig);
          console.log(`[THÀNH CÔNG] Build xong ${item.name || 'Unknown'}`);
        } catch (e) {
          console.error(
            `[LỖI] Build thất bại cho ${item.name}:`,
            (e as any).message || e,
          );
        }
      } else {
        console.warn(`[CẢNH BÁO] Không tìm thấy thư mục: ${pluginDir}`);
      }
    } else {
      console.warn(
        `[CẢNH BÁO] Không thể phân tích đường dẫn từ URL: ${itemPathUrl}`,
      );
    }
  }
  console.log(`\nHoàn tất quá trình build tất cả các plugin trong Repo!`);
}

const inputDir = process.argv[2];
const shouldClean =
  process.argv.includes('--clean') || process.argv[3] === 'clean';

if (!inputDir) {
  console.error(
    'Sử dụng: npx tsx extra/vbook/build.ts <path/to/vbook/repo> [--clean]',
  );
  process.exit(1);
}

buildRepo(path.resolve(inputDir), shouldClean).catch(console.error);
