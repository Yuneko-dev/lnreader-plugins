/**
 * Bypass Cloudflare
 * @param url URL
 * @param type `interstitial` (Interstitial Challenge Pages) | `turnstile` (Cloudflare's smart CAPTCHA alternative)
 * @returns {Promise<boolean>} isOk
 * @deprecated Test only
 */
export const solveCloudflare = async (
  url: string,
  type: 'interstitial' | 'turnstile',
): Promise<boolean> => false;
