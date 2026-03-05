"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "../components/Navbar"; // إذا المسار عندك مختلف عدّليه
import { supabase } from "../lib/supabase";

type AccountType = "merchant" | "small_business" | "delivery" | "supporter";

const countryCityMap: Record<string, string[]> = {
  "فلسطين": ["نابلس", "رام الله", "الخليل", "جنين", "طولكرم", "قلقيلية", "أريحا", "بيت لحم", "طوباس", "سلفيت", "غزة", "رفح", "خان يونس", "دير البلح"],
  "الأردن": ["عمّان", "إربد", "الزرقاء", "العقبة", "السلط", "مادبا", "الكرك", "جرش", "عجلون", "المفرق"],
  "مصر": ["القاهرة", "الإسكندرية", "الجيزة", "الإسماعيلية", "بورسعيد", "السويس", "الأقصر", "أسوان", "طنطا", "المنصورة"],
  "السعودية": ["الرياض", "جدة", "مكة المكرمة", "المدينة المنورة", "الدمام", "الخبر", "الطائف", "تبوك", "أبها", "نجران"],
  "الإمارات": ["دبي", "أبوظبي", "الشارقة", "عجمان", "رأس الخيمة", "الفجيرة", "أم القيوين"],
  "الكويت": ["الكويت العاصمة", "حولي", "الفروانية", "الأحمدي", "الجهراء", "مبارك الكبير"],
  "قطر": ["الدوحة", "الريان", "الوكرة", "الخور", "الشمال", "أم صلال"],
  "البحرين": ["المنامة", "المحرق", "الرفاع", "مدينة عيسى", "مدينة حمد", "سترة"],
  "عُمان": ["مسقط", "صلالة", "نزوى", "صحار", "صور", "البريمي"],
  "العراق": ["بغداد", "البصرة", "الموصل", "أربيل", "كركوك", "النجف", "كربلاء", "الحلة"],
  "سوريا": ["دمشق", "حلب", "حمص", "اللاذقية", "حماة", "دير الزور", "درعا", "الرقة"],
  "لبنان": ["بيروت", "طرابلس", "صيدا", "صور", "زحلة", "جونية"],
  "تونس": ["تونس", "صفاقس", "سوسة", "القيروان", "بنزرت", "قابس"],
  "المغرب": ["الرباط", "الدار البيضاء", "فاس", "مراكش", "طنجة", "أكادير", "مكناس", "وجدة"],
  "الجزائر": ["الجزائر العاصمة", "وهران", "قسنطينة", "عنابة", "بلعباس", "باتنة", "سطيف"],
  "ليبيا": ["طرابلس", "بنغازي", "مصراتة", "الزاوية", "سبها", "البيضاء"],
  "السودان": ["الخرطوم", "أم درمان", "بورتسودان", "كسلا", "الأبيض", "وادي مدني"],
  "اليمن": ["صنعاء", "عدن", "تعز", "الحديدة", "إب", "ذمار", "المكلا"],
};

const arabCountries = Object.keys(countryCityMap);

const countryPhoneRules: Record<string, { length: number | number[]; prefix?: string; label: string }> = {
  "فلسطين":     { length: 10, prefix: "05", label: "10 أرقام يبدأ بـ 05" },
  "الأردن":     { length: 10, prefix: "07", label: "10 أرقام يبدأ بـ 07" },
  "مصر":        { length: 11, prefix: "01", label: "11 رقم يبدأ بـ 01" },
  "السعودية":   { length: 10, prefix: "05", label: "10 أرقام يبدأ بـ 05" },
  "الإمارات":   { length: 10, prefix: "05", label: "10 أرقام يبدأ بـ 05" },
  "الكويت":     { length: 8,  label: "8 أرقام" },
  "قطر":        { length: 8,  label: "8 أرقام" },
  "البحرين":    { length: 8,  label: "8 أرقام" },
  "عُمان":      { length: 8,  label: "8 أرقام" },
  "العراق":     { length: 11, prefix: "07", label: "11 رقم يبدأ بـ 07" },
  "سوريا":      { length: 10, prefix: "09", label: "10 أرقام يبدأ بـ 09" },
  "لبنان":      { length: [7,8], label: "7-8 أرقام" },
  "تونس":       { length: 8,  label: "8 أرقام" },
  "المغرب":     { length: 10, prefix: "06", label: "10 أرقام يبدأ بـ 06" },
  "الجزائر":    { length: 10, prefix: "05", label: "10 أرقام يبدأ بـ 05" },
  "ليبيا":      { length: 10, prefix: "09", label: "10 أرقام يبدأ بـ 09" },
  "السودان":    { length: 10, prefix: "09", label: "10 أرقام يبدأ بـ 09" },
  "اليمن":      { length: 9,  prefix: "7",  label: "9 أرقام يبدأ بـ 7" },
};

const isValidUrl = (val: string): boolean => {
  try {
    const url = new URL(val);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const validatePhone = (phoneVal: string, countryVal: string): string => {
  const digits = phoneVal.replace(/\s/g, "");
  if (!/^\d+$/.test(digits)) return "رقم الهاتف يجب أن يحتوي على أرقام فقط.";
  const rule = countryPhoneRules[countryVal];
  if (!rule) return "";
  const lengths = Array.isArray(rule.length) ? rule.length : [rule.length];
  if (!lengths.includes(digits.length))
    return `رقم الهاتف غير صحيح، المطلوب: ${rule.label}.`;
  if (rule.prefix && !digits.startsWith(rule.prefix))
    return `رقم الهاتف يجب أن يبدأ بـ ${rule.prefix} (${rule.label}).`;
  return "";
};

type ProjectStage = "idea" | "running" | "scaling" | "";
type DeliveryScope = "local" | "international" | "";
type SupportType = "financial" | "consulting" | "partnerships" | "";

export default function RegisterPage() {
  const router = useRouter();

  // Step control (فقط 1 أو 2)
  const [step, setStep] = useState<1 | 2>(1);

  // ============ Step 1: Basic ============
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");

  const handleCountryChange = (val: string) => {
    setCountry(val);
    setCity("");
  };

  const [accountType, setAccountType] = useState<AccountType>("merchant");
  const [bio, setBio] = useState("");

  // ============ Step 2: Dynamic (by type) ============
  // Merchant
  const [storeName, setStoreName] = useState("");
  const [productCategory, setProductCategory] = useState("");
  const [storeLink, setStoreLink] = useState("");
  const [commercialRegNo, setCommercialRegNo] = useState("");

  // Small business
  const [projectName, setProjectName] = useState("");
  const [projectField, setProjectField] = useState("");
  const [projectStage, setProjectStage] = useState<ProjectStage>("");
  const [needs, setNeeds] = useState<string[]>([]);
  const [socialLink, setSocialLink] = useState("");

  // Delivery
  const [companyName, setCompanyName] = useState("");
  const [deliveryScope, setDeliveryScope] = useState<DeliveryScope>("");
  const [deliveryCities, setDeliveryCities] = useState("");
  const [avgDeliveryTime, setAvgDeliveryTime] = useState("");
  const [licenseNo, setLicenseNo] = useState("");

  // Supporter
  const [supportType, setSupportType] = useState<SupportType>("");
  const [fundingRange, setFundingRange] = useState("");
  const [interests, setInterests] = useState("");
  const [professionalLink, setProfessionalLink] = useState("");
  const [previousExperience, setPreviousExperience] = useState("");

  // Proof (ضمن Step 2)
  const [proofLink1, setProofLink1] = useState("");
  const [proofLink2, setProofLink2] = useState("");
  const [proofNote, setProofNote] = useState("");
  const [proofFiles, setProofFiles] = useState<File[]>([]);

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const merged = [...proofFiles, ...selected];
    if (merged.length > 5) {
      setErrorMsg("الحد الأقصى 5 ملفات.");
      return;
    }
    setProofFiles(merged);
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setProofFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // UI states
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Helpers
  const cleanEmail = useMemo(() => email.trim(), [email]);

  const toggleNeed = (value: string) => {
    setNeeds((prev) => {
      if (prev.includes(value)) return prev.filter((x) => x !== value);
      return [...prev, value];
    });
  };

  const validateStep1 = (): string => {
    if (!fullName.trim()) return "يرجى إدخال الاسم الكامل.";
    if (!cleanEmail) return "يرجى إدخال البريد الإلكتروني.";

    // التحقق من صيغة الإيميل الحقيقي
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(cleanEmail)) return "يرجى إدخال بريد إلكتروني صحيح.";

    if (!password) return "يرجى إدخال كلمة المرور.";

    // التحقق من قوة الباسوورد
    if (password.length < 8) return "كلمة المرور يجب أن تكون 8 أحرف على الأقل.";
    if (!/[A-Z]/.test(password)) return "يجب أن تحتوي كلمة المرور على حرف كبير.";
    if (!/[a-z]/.test(password)) return "يجب أن تحتوي كلمة المرور على حرف صغير.";
    if (!/[0-9]/.test(password)) return "يجب أن تحتوي كلمة المرور على رقم.";
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password))
      return "يجب أن تحتوي كلمة المرور على رمز خاص (!@#$...).";

    if (!phone.trim()) return "يرجى إدخال رقم الهاتف.";
    const phoneErr = validatePhone(phone.trim(), country);
    if (phoneErr) return phoneErr;
    if (!country.trim()) return "يرجى إدخال الدولة.";
    if (!city.trim()) return "يرجى إدخال المدينة.";
    if (!bio.trim()) return "يرجى إدخال نبذة قصيرة.";
    return "";
  };

  const validateStep2 = (): string => {
    // حقول حسب النوع
    if (accountType === "merchant") {
      if (!storeName.trim()) return "يرجى إدخال اسم المتجر/العلامة.";
      if (!productCategory.trim()) return "يرجى اختيار/إدخال نوع المنتجات (تصنيف).";
      if (!storeLink.trim()) return "يرجى إدخال رابط صفحة المتجر (إنستغرام/فيسبوك/موقع).";
      if (!isValidUrl(storeLink.trim())) return "رابط صفحة المتجر غير صحيح، يجب أن يبدأ بـ https://";
    }

    if (accountType === "small_business") {
      if (!projectName.trim()) return "يرجى إدخال اسم المشروع.";
      if (!projectField.trim()) return "يرجى إدخال المجال/التصنيف.";
      if (!projectStage) return "يرجى اختيار مرحلة المشروع.";
      if (needs.length === 0) return "يرجى اختيار احتياج واحد على الأقل.";
      if (!socialLink.trim()) return "يرجى إدخال رابط السوشال للمشروع.";
      if (!isValidUrl(socialLink.trim())) return "رابط السوشال غير صحيح، يجب أن يبدأ بـ https://";
    }

    if (accountType === "delivery") {
      if (!companyName.trim()) return "يرجى إدخال اسم الشركة.";
      if (!deliveryScope) return "يرجى اختيار نطاق التوصيل (محلي/دولي).";
      if (!deliveryCities.trim()) return "يرجى إدخال المدن/المناطق التي يتم تغطيتها.";
      if (!avgDeliveryTime.trim()) return "يرجى إدخال متوسط وقت التوصيل.";
      if (!licenseNo.trim()) return "يرجى إدخال رقم الترخيص.";
    }

    if (accountType === "supporter") {
      if (!supportType) return "يرجى اختيار نوع الدعم.";
      if (!fundingRange.trim()) return "يرجى إدخال نطاق التمويل/الدعم.";
      if (!interests.trim()) return "يرجى إدخال المجالات المهتم بها.";
      if (!professionalLink.trim()) return "يرجى إدخال رابط مهني (LinkedIn أو موقع).";
      if (!isValidUrl(professionalLink.trim())) return "الرابط المهني غير صحيح، يجب أن يبدأ بـ https://";
      if (!previousExperience.trim()) return "يرجى إدخال خبرة سابقة أو مشاريع تم دعمها.";
    }

    // إثبات داخل نفس Step 2
    if (!proofLink1.trim()) return "يرجى إدخال رابط إثبات واحد على الأقل.";
    if (!isValidUrl(proofLink1.trim())) return "رابط الإثبات غير صحيح، يجب أن يبدأ بـ https://";
    if (proofLink2.trim() && !isValidUrl(proofLink2.trim())) return "الرابط الإضافي غير صحيح، يجب أن يبدأ بـ https://";
    return "";
  };

  const goNext = () => {
    setErrorMsg("");
    setSuccessMsg("");
    const err = validateStep1();
    if (err) {
      setErrorMsg(err);
      return;
    }
    setStep(2);
  };

  const goBack = () => {
    setErrorMsg("");
    setSuccessMsg("");
    setStep(1);
  };

  const buildTypeSpecificData = () => {
    if (accountType === "merchant") {
      return {
        store_name: storeName.trim(),
        product_category: productCategory.trim(),
        store_link: storeLink.trim(),
        commercial_reg_no: commercialRegNo.trim() || null,
      };
    }

    if (accountType === "small_business") {
      return {
        project_name: projectName.trim(),
        project_field: projectField.trim(),
        project_stage: projectStage,
        needs,
        social_link: socialLink.trim(),
      };
    }

    if (accountType === "delivery") {
      return {
        company_name: companyName.trim(),
        delivery_scope: deliveryScope,
        delivery_cities: deliveryCities.trim(),
        avg_delivery_time: avgDeliveryTime.trim(),
        license_no: licenseNo.trim(),
      };
    }

    // supporter
    return {
      support_type: supportType,
      funding_range: fundingRange.trim(),
      interests: interests.trim(),
      professional_link: professionalLink.trim(),
      previous_experience: previousExperience.trim(),
    };
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    // تأكيد صحة Step 2
    const err = validateStep2();
    if (err) {
      setErrorMsg(err);
      return;
    }

    setLoading(true);

    try {
      // 1) Create Auth user
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
      });

      if (signUpError) {
        setErrorMsg(signUpError.message);
        setLoading(false);
        return;
      }

      const userId = signUpData.user?.id;
      if (!userId) {
        setErrorMsg("تعذر إنشاء المستخدم. يرجى المحاولة مرة أخرى.");
        setLoading(false);
        return;
      }

      // 2) Insert profile
      const { error: profileError } = await supabase.from("profiles").insert({
        id: userId,
        full_name: fullName.trim(),
        phone: phone.trim(),
        country: country.trim(),
        city: city.trim(),
        account_type: accountType,
        status: "pending",
        // بإمكانك إضافة bio للجدول إذا حابة (إذا عندك عمود لها)
        // bio: bio.trim(),
      });

      if (profileError) {
        setErrorMsg(`تعذر حفظ بيانات الملف الشخصي: ${profileError.message}`);
        setLoading(false);
        return;
      }

      // 3) رفع الملفات على Supabase Storage
      const uploadedFileUrls: string[] = [];

      for (const file of proofFiles) {
        const filePath = `${userId}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(filePath, file);

        if (uploadError) {
          setErrorMsg(`تعذر رفع الملف ${file.name}: ${uploadError.message}`);
          setLoading(false);
          return;
        }

        const { data: urlData } = supabase.storage
          .from("documents")
          .getPublicUrl(filePath);

        uploadedFileUrls.push(urlData.publicUrl);
      }

      // 4) Insert application (طلب إنشاء حساب)
      const dataJson = {
        basic: {
          full_name: fullName.trim(),
          email: cleanEmail,
          phone: phone.trim(),
          country: country.trim(),
          city: city.trim(),
          account_type: accountType,
          bio: bio.trim(),
        },
        type_specific: buildTypeSpecificData(),
      };

      const proofJson = {
        proof_link_1: proofLink1.trim(),
        proof_link_2: proofLink2.trim() || null,
        note: proofNote.trim() || null,
        file_urls: uploadedFileUrls.length > 0 ? uploadedFileUrls : null,
      };

      const { error: appError } = await supabase.from("applications").insert({
        user_id: userId,
        account_type: accountType,
        data_json: dataJson,
        proof_json: proofJson,
        status: "pending",
      });

      if (appError) {
        setErrorMsg(`تعذر إرسال الطلب: ${appError.message}`);
        setLoading(false);
        return;
      }

      setSuccessMsg(
        "تم إرسال طلب إنشاء الحساب بنجاح. إذا كان البريد الإلكتروني مسجّلًا، فسيتم إرسال رسالة تأكيد. بعد التأكيد سيتم مراجعة الطلب من الإدارة."
      );

      // توجيه لصفحة pending
      setTimeout(() => router.push("/pending"), 900);
    } catch (errAny: any) {
      setErrorMsg("حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  // خيارات
  const needOptions = [
    { value: "suppliers", label: "موردين" },
    { value: "marketing", label: "تسويق" },
    { value: "funding", label: "تمويل" },
    { value: "partnerships", label: "شراكات" },
  ];

  return (
    <main className="min-h-screen bg-[#f8fafc]">
      <Navbar />

      <div className="flex justify-center items-center py-16 px-4">
        <div className="bg-white shadow-lg rounded-2xl p-8 w-full max-w-2xl border border-[#e6edf5]">
          <h1 className="text-2xl font-bold text-[#273347] mb-2 text-center">
            طلب إنشاء حساب
          </h1>

          <p className="text-center text-sm text-[#273347]/70 mb-6">
            بعد إدخال البيانات، سيتم إرسال رابط لتأكيد البريد الإلكتروني ثم مراجعة الطلب من الإدارة.
          </p>

          {/* Stepper (عرض فقط - غير قابل للنقر) */}
          <div className="flex items-center justify-between mb-8 text-sm">
            <div
              className={`flex-1 text-center py-2 rounded-xl ${
                step === 1
                  ? "bg-[#bbd0e4] text-[#273347] font-semibold"
                  : "bg-[#f1f5f9] text-[#273347]/70"
              }`}
            >
              1) بيانات أساسية
            </div>

            <div className="w-3" />

            <div
              className={`flex-1 text-center py-2 rounded-xl ${
                step === 2
                  ? "bg-[#bbd0e4] text-[#273347] font-semibold"
                  : "bg-[#f1f5f9] text-[#273347]/70"
              }`}
            >
              2) بيانات إضافية + إثبات
            </div>
          </div>

          {/* Messages */}
          {errorMsg && (
            <div className="mb-5 bg-red-50 text-red-700 border border-red-200 rounded-xl p-3 text-sm">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="mb-5 bg-green-50 text-green-700 border border-green-200 rounded-xl p-3 text-sm">
              {successMsg}
            </div>
          )}

          {/* Form */}
          <form onSubmit={onSubmit} className="space-y-6">
            {/* ====================== STEP 1 ====================== */}
            {step === 1 && (
              <>
                <section className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-[#273347] mb-2">
                        الاسم الكامل
                      </label>
                      <input
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]"
                        placeholder="الاسم الكامل"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-[#273347] mb-2">
                        نوع الحساب
                      </label>
                      <select
                        value={accountType}
                        onChange={(e) => setAccountType(e.target.value as AccountType)}
                        className="w-full border border-gray-300 rounded-xl p-3 bg-white focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]"
                      >
                        <option value="merchant">تاجر (جملة)</option>
                        <option value="small_business">مشروع صغير</option>
                        <option value="delivery">شركة توصيل</option>
                        <option value="supporter">داعِم / مستثمر</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-[#273347] mb-2">
                        البريد الإلكتروني
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]"
                        placeholder="name@email.com"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-[#273347] mb-2">
                        كلمة المرور
                      </label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]"
                        placeholder="••••••••"
                      />
                      <p className="mt-1 text-xs text-[#273347]/60">
                        8 أحرف على الأقل، حرف كبير وصغير، رقم، ورمز خاص (!@#$...).
                      </p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-[#273347] mb-2">
                        رقم الهاتف
                      </label>
                      <input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]"
                        placeholder="059xxxxxxx"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-[#273347] mb-2">
                        الدولة
                      </label>
                      <select
                        value={country}
                        onChange={(e) => handleCountryChange(e.target.value)}
                        className="w-full border border-gray-300 rounded-xl p-3 bg-white focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]"
                      >
                        <option value="">اختر الدولة...</option>
                        {arabCountries.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-[#273347] mb-2">
                        المدينة
                      </label>
                      <select
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        disabled={!country}
                        className="w-full border border-gray-300 rounded-xl p-3 bg-white focus:outline-none focus:ring-2 focus:ring-[#bbd0e4] disabled:opacity-50"
                      >
                        <option value="">اختر المدينة...</option>
                        {(countryCityMap[country] || []).map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#273347] mb-2">
                      نبذة قصيرة (سطران)
                    </label>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]"
                      rows={3}
                      placeholder="عرّف بشكل مختصر عن نشاطك..."
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-2">
                    <p className="text-sm text-[#273347]/70">
                      لديك حساب؟{" "}
                      <Link href="/login" className="text-[#546a85] font-semibold hover:underline">
                        تسجيل الدخول
                      </Link>
                    </p>

                    <button
                      type="button"
                      onClick={goNext}
                      className="bg-[#bbd0e4] hover:bg-[#a9c2d8] transition text-[#273347] font-semibold px-6 py-3 rounded-xl"
                    >
                      التالي
                    </button>
                  </div>
                </section>
              </>
            )}

            {/* ====================== STEP 2 ====================== */}
            {step === 2 && (
              <>
                {/* ========== Dynamic fields ========== */}
                <section className="space-y-4">
                  <h2 className="text-lg font-bold text-[#273347]">البيانات الإضافية</h2>

                  {/* Merchant */}
                  {accountType === "merchant" && (
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-[#273347] mb-2">
                          اسم المتجر/العلامة
                        </label>
                        <input
                          value={storeName}
                          onChange={(e) => setStoreName(e.target.value)}
                          className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-[#273347] mb-2">
                          نوع المنتجات (تصنيف)
                        </label>
                        <input
                          value={productCategory}
                          onChange={(e) => setProductCategory(e.target.value)}
                          className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]"
                          placeholder="ملابس، عطور، إلكترونيات..."
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-semibold text-[#273347] mb-2">
                          رابط صفحة المتجر (Instagram/Facebook/Website)
                        </label>
                        <input
                          value={storeLink}
                          onChange={(e) => setStoreLink(e.target.value)}
                          className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]"
                          placeholder="https://..."
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-semibold text-[#273347] mb-2">
                          رقم سجل تجاري (اختياري)
                        </label>
                        <input
                          value={commercialRegNo}
                          onChange={(e) => setCommercialRegNo(e.target.value)}
                          className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]"
                        />
                      </div>
                    </div>
                  )}

                  {/* Small Business */}
                  {accountType === "small_business" && (
                    <div className="space-y-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-[#273347] mb-2">
                            اسم المشروع
                          </label>
                          <input
                            value={projectName}
                            onChange={(e) => setProjectName(e.target.value)}
                            className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-[#273347] mb-2">
                            المجال/التصنيف
                          </label>
                          <input
                            value={projectField}
                            onChange={(e) => setProjectField(e.target.value)}
                            className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]"
                            placeholder="مطاعم، متجر إلكتروني، خدمات..."
                          />
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-[#273347] mb-2">
                            مرحلة المشروع
                          </label>
                          <select
                            value={projectStage}
                            onChange={(e) =>
                              setProjectStage(e.target.value as "idea" | "running" | "scaling" | "")
                            }
                            className="w-full border border-gray-300 rounded-xl p-3 bg-white focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]"
                          >
                            <option value="">اختر...</option>
                            <option value="idea">فكرة</option>
                            <option value="running">يعمل</option>
                            <option value="scaling">توسّع</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-[#273347] mb-2">
                            رابط السوشال
                          </label>
                          <input
                            value={socialLink}
                            onChange={(e) => setSocialLink(e.target.value)}
                            className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]"
                            placeholder="https://..."
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-[#273347] mb-2">
                          الاحتياج الأساسي (اختيار متعدد)
                        </label>
                        <div className="grid md:grid-cols-2 gap-3">
                          {needOptions.map((opt) => (
                            <label
                              key={opt.value}
                              className="flex items-center gap-2 border border-gray-200 rounded-xl p-3 cursor-pointer hover:bg-[#f8fafc]"
                            >
                              <input
                                type="checkbox"
                                checked={needs.includes(opt.value)}
                                onChange={() => toggleNeed(opt.value)}
                              />
                              <span className="text-sm text-[#273347]">{opt.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Delivery */}
                  {accountType === "delivery" && (
                    <div className="space-y-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-[#273347] mb-2">
                            اسم الشركة
                          </label>
                          <input
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-[#273347] mb-2">
                            نطاق التوصيل
                          </label>
                          <select
                            value={deliveryScope}
                            onChange={(e) =>
                              setDeliveryScope(e.target.value as "local" | "international" | "")
                            }
                            className="w-full border border-gray-300 rounded-xl p-3 bg-white focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]"
                          >
                            <option value="">اختر...</option>
                            <option value="local">محلي</option>
                            <option value="international">دولي</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-[#273347] mb-2">
                            المدن/المناطق (افصل بفواصل)
                          </label>
                          <input
                            value={deliveryCities}
                            onChange={(e) => setDeliveryCities(e.target.value)}
                            className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]"
                            placeholder="نابلس، رام الله، ... "
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-[#273347] mb-2">
                            متوسط وقت التوصيل
                          </label>
                          <input
                            value={avgDeliveryTime}
                            onChange={(e) => setAvgDeliveryTime(e.target.value)}
                            className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]"
                            placeholder="مثال: 24-48 ساعة"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-[#273347] mb-2">
                          رقم الترخيص
                        </label>
                        <input
                          value={licenseNo}
                          onChange={(e) => setLicenseNo(e.target.value)}
                          className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]"
                        />
                      </div>
                    </div>
                  )}

                  {/* Supporter */}
                  {accountType === "supporter" && (
                    <div className="space-y-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-[#273347] mb-2">
                            نوع الدعم
                          </label>
                          <select
                            value={supportType}
                            onChange={(e) =>
                              setSupportType(
                                e.target.value as "financial" | "consulting" | "partnerships" | ""
                              )
                            }
                            className="w-full border border-gray-300 rounded-xl p-3 bg-white focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]"
                          >
                            <option value="">اختر...</option>
                            <option value="financial">مالي</option>
                            <option value="consulting">استشارات</option>
                            <option value="partnerships">شراكات</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-[#273347] mb-2">
                            نطاق التمويل/الدعم
                          </label>
                          <input
                            value={fundingRange}
                            onChange={(e) => setFundingRange(e.target.value)}
                            className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]"
                            placeholder="مثال: 500 - 2000$"
                          />
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-[#273347] mb-2">
                            المجالات المهتم بها
                          </label>
                          <input
                            value={interests}
                            onChange={(e) => setInterests(e.target.value)}
                            className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]"
                            placeholder="تجارة إلكترونية، أغذية، تقنية..."
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-[#273347] mb-2">
                            رابط مهني (LinkedIn أو موقع)
                          </label>
                          <input
                            value={professionalLink}
                            onChange={(e) => setProfessionalLink(e.target.value)}
                            className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]"
                            placeholder="https://..."
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-[#273347] mb-2">
                          خبرة سابقة أو مشاريع تم دعمها
                        </label>
                        <textarea
                          value={previousExperience}
                          onChange={(e) => setPreviousExperience(e.target.value)}
                          className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]"
                          rows={3}
                        />
                      </div>
                    </div>
                  )}
                </section>

                {/* ========== Proof (داخل Step 2) ========== */}
                <section className="space-y-4 pt-2">
                  <h2 className="text-lg font-bold text-[#273347]">الإثبات</h2>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-[#273347] mb-2">
                        رابط إثبات (إلزامي)
                      </label>
                      <input
                        value={proofLink1}
                        onChange={(e) => setProofLink1(e.target.value)}
                        className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]"
                        placeholder="رابط متجر/سوشال/موقع"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-[#273347] mb-2">
                        رابط إضافي (اختياري)
                      </label>
                      <input
                        value={proofLink2}
                        onChange={(e) => setProofLink2(e.target.value)}
                        className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]"
                        placeholder="https://..."
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#273347] mb-2">
                      ملاحظة (اختياري)
                    </label>
                    <textarea
                      value={proofNote}
                      onChange={(e) => setProofNote(e.target.value)}
                      className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]"
                      rows={3}
                      placeholder="أي توضيح يفيد الإدارة أثناء المراجعة..."
                    />
                  </div>

                  {/* رفع الملفات */}
                  <div>
                    <label className="block text-sm font-semibold text-[#273347] mb-2">
                      رفع ملفات (اختياري - حد أقصى 5 ملفات)
                    </label>

                    <label className="flex items-center justify-center gap-2 w-full border-2 border-dashed border-[#bbd0e4] rounded-xl p-4 cursor-pointer hover:bg-[#f8fafc] transition">
                      <span className="text-sm text-[#273347]/70">اضغط لاختيار ملف</span>
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleFilesChange}
                        disabled={proofFiles.length >= 5}
                      />
                    </label>

                    {proofFiles.length > 0 && (
                      <ul className="mt-3 space-y-2">
                        {proofFiles.map((file, index) => (
                          <li
                            key={index}
                            className="flex items-center justify-between bg-[#f1f5f9] rounded-xl px-3 py-2 text-sm text-[#273347]"
                          >
                            <span className="truncate max-w-[80%]">{file.name}</span>
                            <button
                              type="button"
                              onClick={() => removeFile(index)}
                              className="text-red-400 hover:text-red-600 font-bold text-lg leading-none"
                            >
                              ×
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}

                    <p className="mt-1 text-xs text-[#273347]/50">
                      {proofFiles.length}/5 ملفات
                    </p>
                  </div>
                </section>

                {/* Buttons */}
                <div className="flex items-center justify-between pt-2 gap-3">
                  <button
                    type="button"
                    onClick={goBack}
                    className="border border-[#bbd0e4] text-[#273347] font-semibold px-6 py-3 rounded-xl hover:bg-[#f8fafc] transition"
                  >
                    رجوع
                  </button>

                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-[#bbd0e4] hover:bg-[#a9c2d8] transition text-[#273347] font-semibold px-6 py-3 rounded-xl disabled:opacity-60"
                  >
                    {loading ? "جارٍ الإرسال..." : "إرسال الطلب"}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      </div>
    </main>
  );
}
