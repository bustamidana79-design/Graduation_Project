# حل مشكلة البريد الإلكتروني والمصادقة

## المشاكل التي تم حلها

### 1. ✅ إيميل التأكيد لا يعمل محلياً ولا على Azure
**المشكلة الأصلية:**
- عند التسجيل، يتم إرسال إيميل تأكيد بـ `emailRedirectTo: ${window.location.origin}/auth/callback`
- محلياً: قد يكون الرابط `http://localhost:3000/auth/callback` (قد يكون خاطئاً في بعض الحالات)
- على Azure: الرابط سيكون خاطئاً تماماً لأنه يستخدم `window.location.origin`

**الحل:**
استخدام متغير البيئة `NEXT_PUBLIC_APP_URL`:
```javascript
const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
  email: cleanEmail,
  password,
  options: {
    emailRedirectTo: `${appUrl}/auth/callback`,
    // ...
  },
});
```

### 2. ✅ إعادة تعيين كلمة المرور لا تعمل بشكل صحيح
**المشكلة الأصلية:**
- صفحة `/forgot-password` تحاول تحديث كلمة المرور مباشرة بـ `supabase.auth.updateUser`
- لا يوجد إيميل يُرسل للمستخدم
- المستخدم لا يستطيع استعادة حسابه إذا نسي كلمة المرور

**الحل:**
1. تحديث `/app/forgot-password/page.tsx`:
   - الآن تطلب الإيميل من المستخدم
   - تستخدم `supabase.auth.resetPasswordForEmail()` لإرسال إيميل بدلاً من التحديث المباشر
   - تأخذ المستخدم إلى `/auth/reset-password`

2. إنشاء صفحة جديدة `/app/auth/reset-password/page.tsx`:
   - تتحقق من صحة الرابط من الإيميل
   - تسمح للمستخدم بإدخال كلمة مرور جديدة
   - تتحقق من قوة كلمة المرور
   - تحدث كلمة المرور وتأخذ المستخدم للـ dashboard

---

## التكوين المطلوب

### متغيرات البيئة الجديدة:

```env
# محلي
NEXT_PUBLIC_APP_URL=http://localhost:3000

# على Azure
NEXT_PUBLIC_APP_URL=https://your-app.azurewebsites.net

# Production
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

> **ملاحظة:** تأكد من تعيين `NEXT_PUBLIC_APP_URL` على Azure عند النشر!

---

## التدفق الجديد

### تسجيل حساب جديد:
```
1. المستخدم يملأ نموذج التسجيل
   ↓
2. يتم إرسال إيميل تأكيد إلى البريد الإلكتروني
   ↓
3. المستخدم يضغط على الرابط في الإيميل
   ↓
4. يتم توجيهه إلى /auth/callback
   ↓
5. يتم التحقق من الـ token وإنشاء الحساب
```

### إعادة تعيين كلمة المرور:
```
1. المستخدم يذهب إلى /forgot-password
   ↓
2. يدخل بريده الإلكتروني
   ↓
3. يتم إرسال إيميل بـ رابط إعادة التعيين
   ↓
4. المستخدم يضغط على الرابط في الإيميل
   ↓
5. يتم توجيهه إلى /auth/reset-password
   ↓
6. يدخل كلمة مرور جديدة
   ↓
7. يتم تحديثها وتوجيهه للـ dashboard
```

---

## الملفات المُعدَّلة

1. **`app/register/page.tsx`**
   - استخدام `NEXT_PUBLIC_APP_URL` في `emailRedirectTo`

2. **`app/admin/register/page.tsx`**
   - استخدام `NEXT_PUBLIC_APP_URL` في `emailRedirectTo`

3. **`app/api/admin/register/route.ts`**
   - استخدام `NEXT_PUBLIC_APP_URL` في `emailRedirectTo`

4. **`app/forgot-password/page.tsx` (تحديث كامل)**
   - تغيير من تحديث مباشر إلى إرسال إيميل
   - استخدام `supabase.auth.resetPasswordForEmail()`

5. **`app/auth/reset-password/page.tsx` (ملف جديد)**
   - صفحة جديدة لمعالجة رابط إعادة التعيين من الإيميل
   - التحقق من صحة الـ token
   - تحديث كلمة المرور

6. **`.env.example` (ملف جديد)**
   - توضيح المتغيرات المطلوبة

---

## الخطوات التالية

1. **على Azure:**
   - اذهب إلى Application Settings
   - أضف `NEXT_PUBLIC_APP_URL=https://your-app.azurewebsites.net`

2. **في Supabase:**
   - تحقق من auth settings وتأكد أن رسائل البريد مفعلة
   - أضف `https://your-app.azurewebsites.net/auth/callback` و `https://your-app.azurewebsites.net/auth/reset-password` في Redirect URLs

3. **اختبر محلياً:**
   ```bash
   npm run dev
   # أنشئ حساب واختبر الإيميل
   # استخدم Supabase admin panel لعرض الرسائل المرسلة
   ```

---

## ملاحظات مهمة

- ✅ Supabase يتعامل مع تشفير كلمة المرور والـ tokens تلقائياً
- ✅ لا توجد كلمات مرور مخزنة في جدول `profiles`
- ✅ كل الأيميلات تُرسل من خلال Supabase Auth
- ⚠️ تأكد من تعيين `NEXT_PUBLIC_APP_URL` على كل بيئة

---

## استكشاف الأخطاء

### الإيميل لا يصل
- تحقق من `NEXT_PUBLIC_APP_URL`
- تحقق من Supabase email settings
- تحقق من Spam folder

### الرابط من الإيميل لا يعمل
- تأكد أن `NEXT_PUBLIC_APP_URL` محدد صحيح
- تأكد من إضافة الـ redirect URLs في Supabase

### كلمة المرور لا تتحدث
- تأكد من أن كلمة المرور قوية (حسب المتطلبات)
- تحقق من أن المستخدم مسجل دخول صحيح من الإيميل
