export const solveCloudflare = async (
  url: string,
  type: 'interstitial' | 'turnstile' = 'turnstile',
): Promise<boolean> => {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return window.electronAPI.invoke('cloudflare:solve', url, type);
  }
  return false;
};
