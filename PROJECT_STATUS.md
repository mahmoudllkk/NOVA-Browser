# PROJECT_STATUS

**الإصدار:** 0.7.0 — تسليم Phases 0-7 مرة واحدة (بطلب من صاحب المشروع، بدل فيز-فيز).

## ⚠️ حالة التحقق (مهم)
| البند | الحالة |
|---|---|
| منطق الاختصارات / الـ URL / Bookmarks HTML / بناء استعلام History | ✅ اتجرّب فعليًا (15 فحص عدّوا) + typecheck نضيف على الملفات دي |
| `npm install` + build + typecheck للمشروع كله | ❌ **لسه متعملش** (مفيش إنترنت في بيئة الكتابة) |
| تشغيل التطبيق نفسه على Windows | ❌ **لسه متجرّبش** |
| Tests لقاعدة البيانات (SQLite) | ❌ مش مكتوبة (محتاجة Electron ABI) — Phase 18 |

أول حاجة تتعمل: `npm install` ثم `npm run typecheck` ثم `npm test` ثم `npm run dev`، وابعتلي أي error. الـ GitHub Action في `.github/workflows/ci.yml` هيعمل typecheck + tests تلقائيًا عند الـ push.

## الفيزات
| Phase | الحالة |
|---|---|
| 0 Planning/Setup | ✅ هيكل + README + Git + CI |
| 1 Foundation | ✅ كود مكتوب — لسه متجرّبش |
| 2 Core engine | ✅ كود مكتوب — لسه متجرّبش |
| 3 UI/UX | ⚠️ جزئي (مفيش Sidebar) |
| 4 Database | ✅ كود مكتوب — لسه متجرّبش |
| 5 Advanced History | ✅ كود مكتوب — فلتر/استعلام متجرّبين منطقيًا بس |
| 6 Shortcuts | ✅ المحرك متجرّب منطقيًا، الربط بالمتصفح لسه |
| 7 Bookmarks/Downloads/Settings | ✅ كود مكتوب — لسه متجرّبش |

## Known bugs / limitations (معروفة من التصميم)
- التنقل من صفحة داخلية (nova://) لموقع (أو العكس) بيستبدل الـ view، فتاريخ Back/Forward للتاب بيتصفّر.
- مفيش drag لإعادة ترتيب التابات.
- الأيقونات حاليًا Unicode glyphs مش icon set احترافي.
- مفيش Sidebar ولا Find-in-page (Ctrl+F متاح للاختصارات الشخصية — الافتراضي Ctrl+F,F = Facebook).
- الـ Popups كلها بتتفتح كتابات جديدة (مع حد أقصى 3 في ثانيتين) — مفيش popup blocker كامل.
- تبديل الـ Profile بيعمل restart للتطبيق.
- صفحة الاختصارات بتعطّل اختصارات المتصفح (Ctrl+T مثلًا) أثناء وجودك فيها عشان تسجيل المفاتيح.
- الـ History بيبحث بـ LIKE (case-insensitive للإنجليزي بس). google.com.eg و youtu.be دومينات منفصلة عن google.com و youtube.com.
- مفيش CSP على الصفحات الداخلية لسه (هتتراجع في Phase 18).
- أرقام إصدارات الـ dependencies في package.json معمولة من الذاكرة ومتأكدش منها.

## Features غير مكتملة
Phase 8 → 19 (AI، Cloud، Accounts، Subscriptions، Android، Updates، Packaging).
