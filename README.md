# NOVA Browser

متصفح Windows مبني بـ **Electron + React + TypeScript + SQLite**. النسخة دي (v0.7.0) بتغطي **Phase 0 → 7**: متصفح كامل بدون AI وبدون حسابات أو Cloud.

## اللي موجود
- Tabs (جديد/إغلاق/تكرار/تثبيت/إعادة فتح)، شريط عنوان ذكي (رابط أو بحث)، Back/Forward/Reload/Stop
- Private window، Profiles مستقلة، Full-screen، Zoom
- History متقدم (فلترة بالموقع، تواريخ، بحث، تجميع، حذف)
- Bookmarks (+ Import/Export HTML)، Downloads، محركات بحث قابلة للتعديل
- اختصارات شخصية متعددة الخطوات (Ctrl+Y ثم Y) مع كشف التعارض
- Dark/Light، إدارة صلاحيات المواقع، مسح بيانات التصفح

## التشغيل
المطلوب: **Node.js 20 LTS** + **Git** + (على Windows) **Visual Studio Build Tools** لو `better-sqlite3` طلب compile.

```bash
cd apps/desktop
npm install          # بيعمل rebuild للـ better-sqlite3 على نسخة Electron تلقائيًا
npm run dev          # وضع التطوير
npm run start        # build + تشغيل
npm test             # unit tests
npm run typecheck
```

التفاصيل بالعربي: [`docs/PHASES_0-7_AR.md`](docs/PHASES_0-7_AR.md) — حالة المشروع: [`PROJECT_STATUS.md`](PROJECT_STATUS.md)
