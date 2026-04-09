"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "../../components/Navbar"; 
import { supabase } from "../../lib/supabase";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { isValidPhoneNumber } from "react-phone-number-input";
type AccountType = "merchant" | "small_business" | "delivery" | "supporter";
import ar from "react-phone-number-input/locale/ar.json";
import countries from "world-countries";
import { City } from "country-state-city";

const disposableDomains = [
  "10minutemail.com",
  "tempmail.com",
  "mailinator.com",
  "guerrillamail.com",
  "yopmail.com",
  "trashmail.com",
  "temp-mail.org",
  "sharklasers.com"
];

const isDisposableEmail = (email: string) => {
  const domain = email.split("@")[1]?.toLowerCase();
  return disposableDomains.includes(domain);
};

const isValidUrl = (val: string): boolean => {
  try {
    const url = new URL(val);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};


type ProjectStage = "idea" | "running" | "scaling" | "";
type DeliveryScope = "local" | "international" | "international_local" | "";
type SupportType = "financial" | "consulting" | "partnerships" | "";

export default function RegisterPage() {
  const router = useRouter();

  // Step control (فقط 1 أو 2)
  const [step, setStep] = useState<1 | 2>(1);

  // ============ Step 1: Basic ============
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [phone, setPhone] = useState<string | undefined>();
  const [country, setCountry] = useState("فلسطين");

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


  const arabCountryNames: Record<string, string> = {
  PS: "فلسطين", JO: "الأردن", SA: "السعودية", EG: "مصر", AE: "الإمارات",
  KW: "الكويت", QA: "قطر", BH: "البحرين", OM: "عُمان", LB: "لبنان",
  SY: "سوريا", IQ: "العراق", MA: "المغرب", TN: "تونس", DZ: "الجزائر",
  LY: "ليبيا", YE: "اليمن", SD: "السودان", TR: "تركيا", DE: "ألمانيا",
  GB: "المملكة المتحدة", FR: "فرنسا", US: "الولايات المتحدة", CA: "كندا",
};
  // Delivery
  const [companyName, setCompanyName] = useState("");
  const [deliveryScope, setDeliveryScope] = useState<DeliveryScope>("");
  const [deliveryCities, setDeliveryCities] = useState<string[]>([]);
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
  const [countryName, setCountryName] = useState("فلسطين");
const [interestsOther, setInterestsOther] = useState("");
const [countryCode, setCountryCode] = useState("PS");
const [productCategoryOther, setProductCategoryOther] = useState("");
const [projectFieldOther, setProjectFieldOther] = useState("");



const arabCitiesMap: Record<string, string[]> = {
  JO: ["عمّان", "الزرقاء", "إربد", "العقبة", "السلط", "مادبا", "جرش", "الكرك"],
  SA: ["الرياض", "جدة", "مكة المكرمة", "المدينة المنورة", "الدمام", "الخبر", "تبوك", "أبها"],
  EG: ["القاهرة", "الإسكندرية", "الجيزة", "أسوان", "الأقصر", "بورسعيد", "السويس", "المنصورة"],
  AE: ["دبي", "أبوظبي", "الشارقة", "عجمان", "رأس الخيمة", "الفجيرة", "أم القيوين"],
  KW: ["الكويت", "حولي", "الفروانية", "الأحمدي", "الجهراء", "مبارك الكبير"],
  QA: ["الدوحة", "الوكرة", "الريان", "الخور", "أم صلال", "الشمال"],
  BH: ["المنامة", "المحرق", "الرفاع", "مدينة عيسى", "مدينة حمد", "سترة"],
  OM: ["مسقط", "صلالة", "نزوى", "صحار", "السيب", "مطرح"],
  LB: ["بيروت", "طرابلس", "صيدا", "صور", "زحلة", "جونية"],
  SY: ["دمشق", "حلب", "حمص", "حماة", "اللاذقية", "دير الزور", "درعا"],
  IQ: ["بغداد", "البصرة", "الموصل", "أربيل", "النجف", "كربلاء", "كركوك"],
  MA: ["الرباط", "الدار البيضاء", "فاس", "مراكش", "أكادير", "طنجة", "مكناس"],
  TN: ["تونس", "صفاقس", "سوسة", "قفصة", "بنزرت", "قابس"],
  DZ: ["الجزائر", "وهران", "قسنطينة", "عنابة", "بجاية", "سطيف"],
  LY: ["طرابلس", "بنغازي", "مصراتة", "الزاوية", "البيضاء", "سبها"],
  YE: ["صنعاء", "عدن", "تعز", "الحديدة", "إب", "ذمار"],
  SD: ["الخرطوم", "أم درمان", "بورتسودان", "كسلا", "الأبيض", "وادي حلفا"],
};

const palestinianCities = [
  "رام الله", "نابلس", "الخليل", "جنين", "طولكرم", "قلقيلية",
  "أريحا", "بيت لحم", "سلفيت", "طوباس", "غزة", "خان يونس",
  "رفح", "دير البلح", "بيت حانون", "القدس", "أبو ديس",
  "بيرزيت", "عنبتا", "يطا", "دورا", "بيت جالا", "بيت ساحور",
];

const cities = useMemo(() => {
  if (!countryCode) return [];
  if (countryCode === "PS") return palestinianCities.map(name => ({ name }));
  if (arabCitiesMap[countryCode]) return arabCitiesMap[countryCode].map(name => ({ name }));
  return City.getCitiesOfCountry(countryCode)?.map(c => ({ name: c.name })) ?? [];
}, [countryCode]);

// معلومات الدولة
const countryData = countries.find(c => c.cca2 === countryCode);

// العملة
let currency = countryData?.currencies
  ? Object.keys(countryData.currencies)[0]
  : "ILS";

// تصحيح بعض الدول
if (countryCode === "PS") {
  currency = "ILS";
}
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
  const emailRegex =/^(?!.*\.\.)[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if (!emailRegex.test(cleanEmail)) return "يرجى إدخال بريد إلكتروني صحيح.";

    if (isDisposableEmail(cleanEmail)) {
  return "لا يسمح باستخدام بريد إلكتروني مؤقت.";
}
    if (!password) return "يرجى إدخال كلمة المرور.";

    // التحقق من قوة الباسوورد
    if (password.length < 8) return "كلمة المرور يجب أن تكون 8 أحرف على الأقل.";
    if (!/[A-Z]/.test(password)) return "يجب أن تحتوي كلمة المرور على حرف كبير.";
    if (!/[a-z]/.test(password)) return "يجب أن تحتوي كلمة المرور على حرف صغير.";
    if (!/[0-9]/.test(password)) return "يجب أن تحتوي كلمة المرور على رقم.";
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password))
      return "يجب أن تحتوي كلمة المرور على رمز خاص (!@#$...).";

    if (!phone) return "يرجى إدخال رقم الهاتف.";
    if (!isValidPhoneNumber(phone))
  return "رقم الهاتف غير صحيح.";
    if (!country.trim()) return "يرجى إدخال الدولة.";
if (bioWordCount < 20) return "يرجى كتابة نبذة تعريفية أكثر تفصيلاً (20 كلمة على الأقل)."  ;
    return "";
  };

  const validateStep2 = (): string => {
    // حقول حسب النوع
    if (accountType === "merchant") {
      if (!storeName.trim()) return "يرجى إدخال اسم المتجر/العلامة.";
if (!productCategory.trim()) return "يرجى اختيار نوع المنتجات.";
if (productCategory === "other" && !productCategoryOther.trim()) return "يرجى كتابة نوع المنتجات.";
      if (!storeLink.trim()) return "يرجى إدخال رابط صفحة المتجر (إنستغرام/فيسبوك/موقع).";
      if (!isValidUrl(storeLink.trim())) return "رابط صفحة المتجر غير صحيح، يجب أن يبدأ بـ https://";
    }

    if (accountType === "small_business") {
      if (!projectName.trim()) return "يرجى إدخال اسم المشروع.";
if (!projectField.trim()) return "يرجى اختيار المجال.";
if (projectField === "other" && !projectFieldOther.trim()) return "يرجى كتابة المجال.";   
      if (!projectStage) return "يرجى اختيار مرحلة المشروع.";
      if (needs.length === 0) return "يرجى اختيار احتياج واحد على الأقل.";
      if (!socialLink.trim()) return "يرجى إدخال رابط السوشال للمشروع.";
      if (!isValidUrl(socialLink.trim())) return "رابط السوشال غير صحيح، يجب أن يبدأ بـ https://";
    }

    if (accountType === "delivery") {
      if (!companyName.trim()) return "يرجى إدخال اسم الشركة.";
      if (!deliveryScope) return "يرجى اختيار نطاق التوصيل (محلي/دولي).";
      if (deliveryCities.length === 0) return "يرجى اختيار مدينة/دولة واحدة على الأقل.";
      if (!avgDeliveryTime.trim()) return "يرجى إدخال متوسط وقت التوصيل.";
      if (!licenseNo.trim()) return "يرجى إدخال رقم الترخيص.";
    }

    if (accountType === "supporter") {
      if (!supportType) return "يرجى اختيار نوع الدعم.";
if (supportType === "financial" && !fundingRange.trim()) return "يرجى إدخال نطاق التمويل/الدعم.";
if (!interests.trim()) return "يرجى اختيار المجال المهتم به.";
if (interests === "other" && !interestsOther.trim()) return "يرجى كتابة المجال.";
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
        product_category: productCategory === "other" ? productCategoryOther.trim() : productCategory.trim(),
        store_link: storeLink.trim(),
        commercial_reg_no: commercialRegNo.trim() || null,
      };
    }

    if (accountType === "small_business") {
      return {
        project_name: projectName.trim(),
        project_field: projectField === "other" ? projectFieldOther.trim() : projectField.trim(),
        project_stage: projectStage,
        needs,
        social_link: socialLink.trim(),
      };
    }

    if (accountType === "delivery") {
      return {
        company_name: companyName.trim(),
        delivery_scope: deliveryScope,
        delivery_cities: deliveryCities,
        avg_delivery_time: avgDeliveryTime.trim(),
        license_no: licenseNo.trim(),
      };
    }

    // supporter
    return {
      support_type: supportType,
      funding_range: fundingRange.trim(),
      interests: interests === "other" ? interestsOther.trim() : interests.trim(),
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
const { data: signUpData, error: signUpError } =
await supabase.auth.signUp({
  email: cleanEmail,
  password,
  options: {
    emailRedirectTo: "http://localhost:3000/auth/callback",
  },
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
         email: cleanEmail,   
        phone: phone,
        country: countryName,
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
// داخل دالة onSubmit في page.tsx، بعد رفع الملفات وقبل إدراج التطبيق

try {
  const aiResponse = await fetch("/api/ai/evaluate-application", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app: {
        data_json: {
          basic: {
            full_name: fullName.trim(),
            email: cleanEmail,
            phone: phone,
            country: countryName,
            bio: bio.trim(),
          },
          type_specific: buildTypeSpecificData(),
        },
        proof_json: {
          proof_link_1: proofLink1.trim(),
          proof_link_2: proofLink2.trim() || null,
          note: proofNote.trim() || null,
          file_urls: uploadedFileUrls, // ✅ هذه هي الصور المرفوعة
        },
        account_type: accountType,
      },
    }),
  });

  const aiResult = await aiResponse.json();
  console.log("AI Evaluation Result:", aiResult);

  await supabase
    .from("applications")
    .update({
      ai_score: aiResult.score,
      ai_recommendation: aiResult.recommendation,
      ai_reason: aiResult.summary,
      ai_checked: true,
    })
    .eq("user_id", userId);
} catch (error) {
  console.error("AI Evaluation Failed:", error);
}
      // 4) Insert application (طلب إنشاء حساب)
      const dataJson = {
        basic: {
          full_name: fullName.trim(),
          email: cleanEmail,
          phone: phone,
          country: countryName,
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
/* ===============================
   AI Evaluation
================================ */

try {

  const aiResponse = await fetch("/api/ai/evaluate-application", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      full_name: fullName,
      email: cleanEmail,
      bio: bio,
      account_type: accountType,
      country: countryName,

      data: buildTypeSpecificData(),

      proof: {
        proof_link_1: proofLink1,
        proof_link_2: proofLink2,
        files: uploadedFileUrls
      }
    })
  });

  const aiResult = await aiResponse.json();

  console.log("AI Evaluation Result:", aiResult);

  // حفظ نتيجة AI في قاعدة البيانات

 await supabase
  .from("applications")
  .update({
    ai_score: aiResult.score,
    ai_recommendation: aiResult.recommendation,
    ai_reason: aiResult.reason,
    ai_checked: true
  })
.eq("user_id", userId);
  
} catch (error) {
  console.error("AI Evaluation Failed:", error);
}

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
// --- إضافة منطق قوة النبذة ---
  const bioWordCount = bio.trim() ? bio.trim().split(/\s+/).length : 0;
  const getBioStatus = () => {
    if (bioWordCount === 0) return { color: "text-gray-400", label: "النبذة فارغة", width: "w-0" };
    if (bioWordCount < 5) return { color: "text-red-500", label: "ضعيفة جداً", width: "w-1/4 bg-red-500" };
    if (bioWordCount < 20) return { color: "text-yellow-600", label: "جيدة", width: "w-2/4 bg-yellow-500" };
    return { color: "text-green-600", label: "احترافية وقوية", width: "w-full bg-green-500" };
  };
  const bioStatus = getBioStatus();
  // -------------------------
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
                        placeholder="name@example.com"
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

                 <div className="grid md:grid-cols-2 gap-4">
  <div>
    <label className="block text-sm font-semibold text-[#273347] mb-2">
      رقم الهاتف
    </label>
    <PhoneInput
      international
      defaultCountry="PS"
      labels={ar}
      value={phone}
      onChange={setPhone}
      onCountryChange={(country) => {
        if (country) {
          const name = ar[country as keyof typeof ar];
          setCountryCode(country);
          setCountryName(name);
          setCountry(name);
        }
      }}
      className="w-full border border-gray-300 rounded-xl p-3"
      placeholder="أدخل رقم الهاتف"
    />
  </div>

  <div className="grid grid-cols-2 gap-3">
    <div>
      <label className="block text-sm font-semibold text-[#273347] mb-2">
        الدولة
      </label>
      <input
        type="text"
        value={countryName || "فلسطين"}
        readOnly
        className="w-full border border-gray-300 rounded-xl p-3 bg-gray-100"
      />
    </div>
    <div>
      <label className="block text-sm font-semibold text-[#273347] mb-2">
        العملة
      </label>
      <input
        type="text"
        value={currency}
        readOnly
        className="w-full border border-gray-300 rounded-xl p-3 bg-gray-100"
      />
    </div>
  </div>
</div>
                  
                 <div className="space-y-2">
  <div className="flex justify-between items-center">
    <label className="block text-sm font-semibold text-[#273347]">
      النبذة التعريفية (عن نشاطك)
    </label>
    {/* عرض الحالة وعدد الكلمات */}
    <span className={`text-xs font-bold transition-colors duration-300 ${bioStatus.color}`}>
      {bioStatus.label} ({bioWordCount} كلمة)
    </span>
  </div>

  <textarea
    value={bio}
    onChange={(e) => setBio(e.target.value)}
    className={`w-full border rounded-xl p-3 focus:outline-none focus:ring-2 transition-all duration-300 ${
      bioWordCount > 0 && bioWordCount < 5 ? "border-red-300 focus:ring-red-100" : "border-gray-300 focus:ring-[#bbd0e4]"
    }`}
    rows={3}
    placeholder="مثال: متجر (اسم المتجر) لبيع الملابس بالجملة، نغطي منطقة نابلس ونوفر جودة عالية..."
  />

  {/* شريط القوة البصري */}
  <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
    <div className={`h-full transition-all duration-500 ease-out ${bioStatus.width}`}></div>
  </div>

  {/* نصيحة ذكية تظهر أسفل الحقل */}
  <div className="bg-[#f0f7ff] border border-[#d1e8ff] p-3 rounded-xl mt-2">
    <p className="text-[11px] text-[#2c5282] leading-relaxed">
      <strong>💡 نصيحة للقبول:</strong> النبذة الاحترافية تزيد من ثقة النظام في طلبك. اذكر (تخصصك، والمدن التي تغطيها). يفضل أن تكون أكثر من 20كلمة.
    </p>
  </div>
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
  <select
    value={productCategory}
    onChange={(e) => setProductCategory(e.target.value)}
    className="w-full border border-gray-300 rounded-xl p-3 bg-white focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]"
  >
    <option value="">اختر التصنيف...</option>
    <option value="clothing">ملابس وأزياء</option>
    <option value="perfumes">عطور ومستحضرات</option>
    <option value="electronics">إلكترونيات</option>
    <option value="food">مواد غذائية</option>
    <option value="furniture">أثاث ومفروشات</option>
    <option value="toys">ألعاب وأطفال</option>
    <option value="sports">رياضة ولياقة</option>
    <option value="books">كتب وقرطاسية</option>
    <option value="jewelry">مجوهرات وإكسسوارات</option>
    <option value="health">صحة وعناية</option>
    <option value="tools">أدوات ومعدات</option>
    <option value="other">أخرى</option>
  </select>
  {productCategory === "other" && (
    <input
      value={productCategoryOther}
      onChange={(e) => setProductCategoryOther(e.target.value)}
      className="w-full mt-2 border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]"
      placeholder="اكتب نوع المنتجات..."
    />
  )}
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
                          <select
  value={projectField}
  onChange={(e) => setProjectField(e.target.value)}
  className="w-full border border-gray-300 rounded-xl p-3 bg-white focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]"
>
  <option value="">اختر المجال...</option>
  <option value="food">مطاعم وأغذية</option>
  <option value="ecommerce">متجر إلكتروني</option>
  <option value="services">خدمات</option>
  <option value="technology">تقنية وبرمجة</option>
  <option value="education">تعليم وتدريب</option>
  <option value="health">صحة وعناية</option>
  <option value="fashion">أزياء وموضة</option>
  <option value="crafts">حرف يدوية</option>
  <option value="beauty">تجميل</option>
  <option value="tourism">سياحة وسفر</option>
  <option value="agriculture">زراعة</option>
  <option value="other">أخرى</option>
</select>
{projectField === "other" && (
  <input
    value={projectFieldOther ?? ""}
    onChange={(e) => setProjectFieldOther(e.target.value)}
    className="w-full mt-2 border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]"
    placeholder="اكتب المجال..."
  />
)}
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
                              setDeliveryScope(e.target.value as "local" | "international" | "international_local" | "")
                            }
                            className="w-full border border-gray-300 rounded-xl p-3 bg-white focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]"
>
                            <option value="">اختر...</option>
                            <option value="local">محلي</option>
                            <option value="international">دولي</option>
                            <option value="international_local">محلي ودولي</option>

                          </select>
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
  <label className="block text-sm font-semibold text-[#273347] mb-2">
    {deliveryScope === "international" ? "الدول" : "المدن/المناطق"}
    {deliveryScope === "international_local" ? " (مدن + دول)" : ""}
  </label>

  {/* المدن المحلية */}
  {(deliveryScope === "local" || deliveryScope === "international_local") && (
    <div className="mb-3">
      {deliveryScope === "international_local" && (
        <p className="text-xs text-[#273347]/60 mb-2">المدن المحلية:</p>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto border border-gray-200 rounded-xl p-3">
        {cities.map((city) => (
          <label key={city.name} className="flex items-center gap-2 cursor-pointer hover:bg-[#f8fafc] rounded-lg p-1">
            <input
              type="checkbox"
              checked={deliveryCities.includes(city.name)}
              onChange={() => {
                setDeliveryCities(prev =>
                  prev.includes(city.name)
                    ? prev.filter(c => c !== city.name)
                    : [...prev, city.name]
                );
              }}
              className="accent-[#bbd0e4]"
            />
            <span className="text-sm text-[#273347]">{city.name}</span>
          </label>
        ))}
      </div>
    </div>
  )}

  {/* الدول الدولية */}
  {(deliveryScope === "international" || deliveryScope === "international_local") && (
    <div>
      {deliveryScope === "international_local" && (
        <p className="text-xs text-[#273347]/60 mb-2">الدول الدولية:</p>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto border border-gray-200 rounded-xl p-3">
        {Object.entries(arabCountryNames)
  .filter(([code]) => code !== countryCode)
  .map(([code, name]) => (
          <label key={code} className="flex items-center gap-2 cursor-pointer hover:bg-[#f8fafc] rounded-lg p-1">
            <input
              type="checkbox"
              checked={deliveryCities.includes(name)}
              onChange={() => {
                setDeliveryCities(prev =>
                  prev.includes(name)
                    ? prev.filter(c => c !== name)
                    : [...prev, name]
                );
              }}
              className="accent-[#bbd0e4]"
            />
            <span className="text-sm text-[#273347]">{name}</span>
          </label>
        ))}
      </div>
    </div>
  )}

  {deliveryCities.length > 0 && (
    <p className="mt-2 text-xs text-[#273347]/60">
      تم اختيار: {deliveryCities.join("، ")}
    </p>
  )}
</div>
                        <div>
  <label className="block text-sm font-semibold text-[#273347] mb-2">
    متوسط وقت التوصيل
  </label>
  <select
    value={avgDeliveryTime}
    onChange={(e) => setAvgDeliveryTime(e.target.value)}
    className="w-full border border-gray-300 rounded-xl p-3 bg-white focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]"
  >
    <option value="">اختر الوقت...</option>
    <option value="same_day">نفس اليوم</option>
    <option value="1_day">يوم واحد</option>
    <option value="1_2_days">1 - 2 يوم</option>
    <option value="2_3_days">2 - 3 أيام</option>
    <option value="3_5_days">3 - 5 أيام</option>
    <option value="1_week">أسبوع</option>
    <option value="above_week">أكثر من أسبوع</option>
  </select>
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
  onChange={(e) => {
    setSupportType(e.target.value as "financial" | "consulting" | "partnerships" | "");
    if (e.target.value !== "financial") setFundingRange("");
  }}
  className="w-full border border-gray-300 rounded-xl p-3 bg-white focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]"
>
  <option value="">اختر...</option>
  <option value="financial">مالي</option>
  <option value="consulting">استشارات</option>
  <option value="partnerships">شراكات</option>
</select>
                        </div>

                       {supportType === "financial" && (
<div>
  <label className="block text-sm font-semibold text-[#273347] mb-2">
    نطاق التمويل/الدعم
  </label>
  
                       <select
  value={fundingRange}
  onChange={(e) => setFundingRange(e.target.value)}
  className="w-full border border-gray-300 rounded-xl p-3 bg-white focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]"
>
  <option value="">اختر النطاق...</option>
  <option value="under_500">أقل من 500 {currency}</option>
  <option value="500_2000">500 - 2,000 {currency}</option>
  <option value="2000_5000">2,000 - 5,000 {currency}</option>
  <option value="5000_10000">5,000 - 10,000 {currency}</option>
  <option value="10000_50000">10,000 - 50,000 {currency}</option>
  <option value="above_50000">أكثر من 50,000 {currency}</option>
</select>
                        </div>
                       )}</div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-[#273347] mb-2">
                            المجالات المهتم بها
                          </label>
                         <select
  value={interests}
  onChange={(e) => setInterests(e.target.value)}
  className="w-full border border-gray-300 rounded-xl p-3 bg-white focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]"
>
  <option value="">اختر المجال...</option>
  <option value="ecommerce">تجارة إلكترونية</option>
  <option value="food">أغذية ومطاعم</option>
  <option value="technology">تقنية وبرمجة</option>
  <option value="fashion">أزياء وموضة</option>
  <option value="health">صحة وعناية</option>
  <option value="education">تعليم وتدريب</option>
  <option value="agriculture">زراعة</option>
  <option value="tourism">سياحة وسفر</option>
  <option value="crafts">حرف يدوية</option>
  <option value="real_estate">عقارات</option>
  <option value="other">أخرى</option>
</select>
{interests === "other" && (
  <input
    value={interestsOther ?? ""}
    onChange={(e) => setInterestsOther(e.target.value)}
    className="w-full mt-2 border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]"
    placeholder="اكتب المجال..."
  />
)}
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