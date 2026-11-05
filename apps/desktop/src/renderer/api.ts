declare global {
  interface Window {
    nova: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
      on: (channel: string, cb: (...args: any[]) => void) => () => void;
    };
  }
}

/** call<T>('history.list', filter) -> invokes IPC channel "nova:history.list" */
export function call<T = unknown>(name: string, ...args: unknown[]): Promise<T> {
  return window.nova.invoke(`nova:${name}`, ...args) as Promise<T>;
}
export const on = (channel: string, cb: (...args: any[]) => void) => window.nova.on(channel, cb);

export function errMsg(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  return m.replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
}
