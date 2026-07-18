import type { Plugin } from '@/types/plugin';

const pluginModules = import.meta.glob<Plugin.PluginBase>(
  ['/plugins/*/*/index.ts', '!/plugins/multisrc/**'],
  {
    eager: true,
    import: 'default',
  },
);

const brokenModules = import.meta.glob(['/plugins/*/*/BROKEN'], {
  eager: true,
  query: '?raw',
});

const brokenPluginDirs = new Set(
  Object.keys(brokenModules).map(path => path.replace(/\/BROKEN$/, '')),
);

// console.log('Broken plugins:', Array.from(brokenPluginDirs));

const plugins = Object.entries(pluginModules)
  .filter(([path]) => {
    // /plugins/en/plugin1/index.ts -> /plugins/en/plugin1
    const pluginDir = path.replace(/\/index\.ts$/, '');
    return !brokenPluginDirs.has(pluginDir);
  })
  .sort(([firstPath], [secondPath]) =>
    firstPath < secondPath ? -1 : firstPath > secondPath ? 1 : 0,
  )
  .map(([, plugin]) => plugin);

export default plugins;
