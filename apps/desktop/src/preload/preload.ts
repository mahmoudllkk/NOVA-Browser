import { contextBridge, ipcRenderer } from 'electron';

// Minimal bridge. The real security check happens in the main process (sender validation).
const EVENTS = new Set(['nova:state', 'nova:settings', 'nova:downloads', 'nova:focus-address']);

contextBridge.exposeInMainWorld('nova', {
  invoke: (channel: string, ...args: unknown[]): Promise<unknown> => {
    if (typeof channel !== 'string' || !channel.startsWith('nova:')) return Promise.reject(new Error('Blocked channel'));
    return ipcRenderer.invoke(channel, ...args);
  },
  on: (channel: string, cb: (...args: unknown[]) => void): (() => void) => {
    if (!EVENTS.has(channel)) throw new Error('Blocked event');
    const handler = (_e: unknown, ...args: unknown[]) => cb(...args);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  }
});
