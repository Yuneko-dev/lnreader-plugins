interface ElectronAPI {
  invoke(channel: string, ...args: unknown[]): Promise<any>;
}
declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
export {};
