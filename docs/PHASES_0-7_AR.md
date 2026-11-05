# NOVA Browser — شرح Phases 0-7 (بالمصري)

## 1) الفكرة العامة (Architecture)
Electron فيه **عمليتين**:
- **Main process** (`src/main`): Node.js كامل الصلاحيات. بيعمل الـ window والتابات وبيكلم قاعدة البيانات SQLite.
- **Renderer** (`src/renderer`): صفحات React (الشريط العلوي + صفحات History/Settings...). معندهاش صلاحيات Node.

التابات نفسها = `WebContentsView` (مش iframe). كل موقع في view لوحده، **sandboxed** وبدون أي API للتطبيق. الشريط العلوي (UI) هو view تحت كل التابات.

الاتصال بين الاتنين = **IPC** عن طريق `preload.ts` (جسر صغير جدًا). والـ main بيرفض أي طلب مش جاي من صفحات التطبيق نفسها (`ipc.ts → handle()`): ده اللي بيمنع أي موقع من إنه يقرأ History بتاعك.

## 2) الفيزات وملفاتها
| Phase | الملفات الأساسية |
|---|---|
| 0 | `README.md`, `PROJECT_STATUS.md`, `.gitignore`, `.github/workflows/ci.yml` |
| 1 | `main.ts`, `preload/preload.ts`, `context.ts`, `ipc.ts`, `vite.config.ts` |
| 2 | `browser/window.ts` (Tabs, navigation, popups, permissions في `session.ts`) |
| 3 | `renderer/BrowserUI.tsx`, `styles.css` |
| 4 | `db/database.ts` (migrations), `db/*.ts`, `profiles.ts` |
| 5 | `db/history.ts`, `db/history-query.ts`, `pages/History.tsx` |
| 6 | `shared/shortcut-engine.ts`, `db/shortcuts.ts`, `pages/Shortcuts.tsx` |
| 7 | `db/bookmarks.ts`, `browser/downloads.ts`, `pages/Settings.tsx`, `shared/bookmarks-html.ts` |

## 3) قرارات مهمة وليه
- **better-sqlite3**: سريع ومتزامن (synchronous) فمناسب لـ Electron main. عيبه إنه native module لازم يتعمله rebuild لنسخة Electron (`postinstall` بيعملها).
- **tldts** لتحديد الدومين: عشان `m.youtube.com` و `www.youtube.com` يتجمعوا تحت `youtube.com`، و`bbc.co.uk` يتعامل صح (Public Suffix List). مفيش regex بيتخمن.
- **Migrations**: `PRAGMA user_version`. عشان تغير الـ schema ضيف عنصر جديد في آخر مصفوفة `MIGRATIONS`، ومتعدلش القديم أبدًا.
- **Profile = فولدر + DB + session partition** مستقلين. عشان كده الاختصارات والـ History مستقلين بين الـ Profiles.
- **Private window**: session في الذاكرة بس (`private-<uuid>`) ومفيش تسجيل في History.
- **الاختصارات**: `before-input-event` بيلتقط المفاتيح حتى وانت جوه الموقع. الخطوة الأولى لازم فيها Ctrl/Alt عشان متبوّظش الكتابة. الخطوة التانية بتشتغل حتى لو لسه ماسك Ctrl.

## 4) تجربة يدوية (Checklist)
1. `npm run dev` — لازم يفتح نافذة بـ New Tab.
2. اكتب `youtube.com` في الشريط → يفتح. اكتب `hello world` → بحث.
3. افتح 3 مواقع + شوف `Ctrl+H`: جرّب الفلاتر (YouTube/Other) والتجميع والبحث والمسح.
4. `Ctrl+Y` وبعدها `Y` → YouTube في تاب جديد. `Ctrl+G` ثم `G` → Google.
5. أضف اختصار فيه تعارض → لازم يظهر التعارض وزر "عطّلهم واحفظ".
6. `Ctrl+Shift+N` → Private. زر ☆ و `Ctrl+D` للـ Bookmark. حمّل ملف → صفحة Downloads.
7. فصل النت وافتح موقع → صفحة الخطأ + "جرّب تاني".
8. Settings: Dark mode، محرك بحث جديد، إنشاء Profile.

## 5) أخطاء شائعة
| الخطأ | الحل |
|---|---|
| `NODE_MODULE_VERSION ... better_sqlite3.node` | `cd apps/desktop && npx electron-builder install-app-deps` |
| `gyp ERR! find VS` | ثبّت **Visual Studio Build Tools** (Desktop development with C++) |
| شاشة بيضا في `dev` | تأكد إن `localhost:5173` شغال (`npm run dev:renderer`) |
| شاشة بيضا في `start` | شغّل `npm run build` وتأكد إن `dist/renderer/index.html` موجود |
| `Forbidden IPC sender` في الـ console | طبيعي لو صفحة غير تابعة للتطبيق حاولت تنادي الـ API |

## 6) Git و GitHub (اعمل ده بنفسك عشان تتعلم)
```bash
cd NOVA-Browser
git init -b main
git add .
git status                      # راجع إن مفيش .env أو *.db أو node_modules
git commit -m "Phases 0-7: core browser (v0.7.0)"
# اعمل repo فاضي اسمه NOVA-Browser على github.com (من غير README) ثم:
git remote add origin https://github.com/<username>/NOVA-Browser.git
git push -u origin main
```
- لو غلطت في commit: `git revert <hash>` (آمن) — ومتستخدمش `reset --hard` غير وانت فاهم هيعمل إيه.
- لو لقيت error في الـ CI (الـ Actions tab) انسخلي النص وابعته.
