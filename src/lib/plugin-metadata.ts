import { ContentType, ContentWarning } from '@/types/constants';
import type { Plugin } from '@/types/plugin';

type PluginMetadata = Pick<
  Plugin.PluginBase,
  'contentType' | 'contentWarning' | 'name'
>;

export const R18_PLUGIN_NAME_COLOR = 'rgb(210, 15, 57)';

const getContentTypePrefix = (
  contentType?: Plugin.PluginBase['contentType'],
) => {
  switch (contentType) {
    case ContentType.VIDEO:
      return '📺 ';
    case ContentType.IMAGE:
      return '🖼️ ';
    case ContentType.MIXED:
      return '🧭 ';
    default:
      return '';
  }
};

export const getPluginDisplayName = (plugin: PluginMetadata) =>
  getContentTypePrefix(plugin.contentType) + plugin.name;

export const hasR18ContentWarning = (
  contentWarning?: Plugin.PluginBase['contentWarning'],
) => (contentWarning ?? ContentWarning.UNSPECIFIED) > ContentWarning.SAFE;

export const getPluginNameColor = (plugin: PluginMetadata) =>
  hasR18ContentWarning(plugin.contentWarning)
    ? R18_PLUGIN_NAME_COLOR
    : undefined;
