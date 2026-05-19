class ElectronStorage {
  private pluginId = '__global__';
  private cache: Record<string, { value: any; expires?: number }> = {};

  async init(pluginId?: string) {
    if (pluginId) this.pluginId = pluginId;
    this.cache = await window.electronAPI!.invoke(
      'storage:init',
      this.pluginId,
    );
  }

  set(key: string, value: any, expires?: Date | number): void {
    const exp = expires instanceof Date ? expires.getTime() : expires;
    this.cache[key] = { value, expires: exp };
    window.electronAPI!.invoke('storage:set', this.pluginId, key, value, exp);
  }

  get(key: string): any {
    const item = this.cache[key];
    if (!item) return undefined;
    if (item.expires && Date.now() > item.expires) {
      this.delete(key);
      return undefined;
    }
    return item.value;
  }

  getAllKeys(): string[] {
    return Object.keys(this.cache);
  }
  delete(key: string): void {
    delete this.cache[key];
    window.electronAPI!.invoke('storage:delete', this.pluginId, key);
  }
  clearAll(): void {
    this.cache = {};
    window.electronAPI!.invoke('storage:clear-all', this.pluginId);
  }
}

export const storage = new ElectronStorage();
export const localStorage = window.localStorage;
export const sessionStorage = window.sessionStorage;
