import { dialog, type Session, type WebContents } from 'electron';
import { ctx, isAppUrl } from '../context';

const AUTO_ALLOW = new Set(['fullscreen', 'clipboard-sanitized-write']);
const ASK = new Set(['media', 'geolocation', 'notifications', 'midi', 'pointerLock', 'clipboard-read', 'display-capture', 'idle-detection']);
const LABELS: Record<string, string> = {
  media: 'الكاميرا / الميكروفون', geolocation: 'موقعك الجغرافي', notifications: 'إرسال إشعارات', midi: 'أجهزة MIDI',
  pointerLock: 'التحكم في الماوس', 'clipboard-read': 'قراءة الـ Clipboard', 'display-capture': 'تسجيل الشاشة', 'idle-detection': 'معرفة لو بتستخدم الجهاز'
};

const configured = new WeakSet<Session>();

function secureOrigin(origin: string) {
  return origin.startsWith('https://') || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1');
}

async function decide(permission: string, requestingUrl: string, isPrivate: boolean): Promise<boolean> {
  if (isAppUrl(requestingUrl)) return AUTO_ALLOW.has(permission);
  if (AUTO_ALLOW.has(permission)) return true;
  if (!ASK.has(permission)) return false; // default deny: usb, hid, serial, openExternal, ...
  let origin: string;
  try { origin = new URL(requestingUrl).origin; } catch { return false; }
  if (!secureOrigin(origin)) return false;
  const stored = ctx.permissions.get(origin, permission);
  if (stored) return stored === 'allow';
  const r = await dialog.showMessageBox({
    type: 'question',
    title: 'طلب صلاحية',
    message: `${new URL(origin).host} عايز يستخدم: ${LABELS[permission] ?? permission}`,
    buttons: ['السماح (Allow)', 'حظر (Block)'],
    defaultId: 1,
    cancelId: 1,
    checkboxLabel: isPrivate ? undefined : 'افتكر قراري لهذا الموقع',
    checkboxChecked: false
  });
  const allow = r.response === 0;
  if (r.checkboxChecked && !isPrivate) ctx.permissions.set(origin, permission, allow ? 'allow' : 'deny');
  return allow;
}

export function configureSession(ses: Session, opts: { isPrivate: boolean }) {
  if (configured.has(ses)) return;
  configured.add(ses);
  // Sites often break when they see "Electron" in the User-Agent, so we present a normal Chromium UA.
  ses.setUserAgent(ses.getUserAgent().replace(/\s(?:Electron|nova-desktop|NOVA[^/\s]*)\/\S+/gi, ''));
  ses.setPermissionRequestHandler((_wc: WebContents, permission, callback, details) => {
    decide(permission, details.requestingUrl, opts.isPrivate).then(callback, () => callback(false));
  });
  ses.setPermissionCheckHandler((_wc, permission, origin) => {
    if (isAppUrl(origin)) return AUTO_ALLOW.has(permission);
    if (AUTO_ALLOW.has(permission)) return true;
    return ctx.permissions.get(origin, permission) === 'allow';
  });
  ctx.downloads.attach(ses, opts.isPrivate);
}
