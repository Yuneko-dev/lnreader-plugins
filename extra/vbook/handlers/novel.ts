import * as fs from 'fs';
import * as path from 'path';
import { transformVBookScript } from '../ast';
import { evaluateStaticArray } from '../evaluator';

export async function handleNovelPlugin(
  inputDir: string,
  config: any,
  id: string,
  pluginName: string,
  folderName: string,
): Promise<string> {
  const templatePath = path.join(
    process.cwd(),
    'extra/vbook/templates/plugin.ts',
  );
  let template = fs.readFileSync(templatePath, 'utf-8');

  const safeClassName = folderName.replace(/[^a-zA-Z0-9]/g, '');
  const className =
    safeClassName.charAt(0).toUpperCase() + safeClassName.slice(1) + 'Plugin';

  template = template.replace(/__PLUGIN_CLASS_NAME__/g, className);
  template = template.replace(/__PLUGIN_ID__/g, id);
  template = template.replace(/__PLUGIN_NAME__/g, pluginName);
  template = template.replace(
    /__PLUGIN_SITE__/g,
    config.metadata.source.replace(/\/$/, ''),
  );
  template = template.replace(
    /__PLUGIN_ICON__/g,
    `src/multi/vbook_${folderName}/icon.png`,
  );

  const loadScriptRecursiveRaw = (
    filename: string,
    loaded: Set<string> = new Set(),
  ): string => {
    if (!filename || loaded.has(filename)) return '';
    loaded.add(filename);
    const filepath = path.join(inputDir, 'src', filename);
    if (!fs.existsSync(filepath)) return '';

    let code = fs.readFileSync(filepath, 'utf-8');
    const loadRegex = /load\(['"](.*?)['"]\);?/g;
    let match;
    let injectedDeps = '';
    while ((match = loadRegex.exec(code)) !== null) {
      injectedDeps += loadScriptRecursiveRaw(match[1], loaded) + '\n';
    }

    code = code.replace(loadRegex, '');
    return injectedDeps + '\n' + code;
  };

  const rawHome = loadScriptRecursiveRaw(config.script['home']);
  const tabs = evaluateStaticArray('', rawHome);

  const rawGenre = loadScriptRecursiveRaw(config.script['genre']);
  const genres = evaluateStaticArray('', rawGenre);

  const filtersObj: any = {
    tab: {
      type: 'Picker',
      label: 'Chuyên mục',
      value: '0',
      options: tabs.map((t, i) => ({
        label: t.title || `Tab ${i}`,
        value: String(i),
      })),
    },
  };

  if (genres.length > 0) {
    filtersObj.genre = {
      type: 'Picker',
      label: 'Thể loại',
      value: '',
      options: [
        { label: 'Tất cả', value: '' },
        ...genres.map(g => ({
          label: g.title || g.name || '',
          value: g.input || g.url || '',
        })),
      ],
    };
  }

  template = template.replace(
    '__FILTERS_OBJECT__',
    JSON.stringify(filtersObj, null, 2).replace(
      /"Picker"/g,
      'FilterTypes.Picker',
    ),
  );
  template = template.replace('__TABS_ARRAY__', JSON.stringify(tabs));
  template = template.replace('__GENRES_ARRAY__', JSON.stringify(genres));

  const genScriptName =
    config.script['gen'] ||
    (tabs[0] && tabs[0].script) ||
    (genres[0] && genres[0].script);
  const genTransformed = transformVBookScript(
    loadScriptRecursiveRaw(genScriptName),
  );
  template = template.replace(
    '/* __VBOOK_GEN__ */',
    () =>
      `genResult = await (async () => {\n${genTransformed}\nreturn await execute(url, page);\n})();`,
  );

  const detailTransformed = transformVBookScript(
    loadScriptRecursiveRaw(config.script['detail']),
  );
  template = template.replace(
    '/* __VBOOK_DETAIL__ */',
    () =>
      `detailResult = await (async () => {\n${detailTransformed}\nreturn await execute(url);\n})();`,
  );

  const tocTransformed = transformVBookScript(
    loadScriptRecursiveRaw(config.script['toc']),
  );
  template = template.replace(
    '/* __VBOOK_TOC__ */',
    () =>
      `tocResult = await (async () => {\n${tocTransformed}\nreturn await execute(url);\n})();`,
  );

  const chapTransformed = transformVBookScript(
    loadScriptRecursiveRaw(config.script['chap']),
  );
  template = template.replace(
    '/* __VBOOK_CHAP__ */',
    () =>
      `return await (async () => {\n${chapTransformed}\nreturn await execute(url);\n})();`,
  );

  const searchTransformed = transformVBookScript(
    loadScriptRecursiveRaw(config.script['search']),
  );
  template = template.replace(
    '/* __VBOOK_SEARCH__ */',
    () =>
      `searchResult = await (async () => {\n${searchTransformed}\nreturn await execute(key, page);\n})();`,
  );

  return template;
}
