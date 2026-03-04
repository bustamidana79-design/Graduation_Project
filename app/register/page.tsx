"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "../../components/Navbar"; // عدّلي المسار إذا مختلف
import { supabase } from "../lib/supabase";

type AccountType = "merchant" | "small_business" | "delivery" | "supporter";
type ProjectStage = "idea" | "running" | "scaling" | "";
type DeliveryScope = "local" | "international" | "";
type SupportType = "financial" | "consulting" | "partnerships" | "";

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("merchant");
  const [bio, setBio] = useState("");

  // Step 2
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

  // Proof
  const [proofLink1, setProofLink1] = useState("");
  const [proofLink2, setProofLink2] = useState("");
  const [proofNote, setProofNote] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);

  // UI states
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const cleanEmail = useMemo(() => email.trim(), [email]);

  const toggleNeed = (value: string) => {
    setNeeds((prev) => (prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]));
  };

  const validatePassword = (pwd: string) => {
    const strongPwd =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{6,}$/;
    return strongPwd.test(pwd);
  };

  const validateStep1 = (): string => {
    if (!fullName.trim()) return "يرجى إدخال الاسم الكامل.";
    if (!cleanEmail) return "يرجى إدخال البريد الإلكتروني.";
    if (!password) return "يرجى إدخال كلمة المرور.";
    if (!validatePassword(password))
      return "كلمة المرور يجب أن تحتوي على 6 أحرف على الأقل، حرف كبير، حرف صغير، رقم ورمز.";
    if (!phone.trim()) return "يرجى إدخال رقم الهاتف.";
    if (!country.trim()) return "يرجى اختيار الدولة.";
    if (!city.trim()) return "يرجى اختيار المدينة.";
    if (!bio.trim()) return "يرجى إدخال نبذة قصيرة.";
    return "";
  };

  const validateStep2 = (): string => {
    if (accountType === "merchant") {
      if (!storeName.trim()) return "يرجى إدخال اسم المتجر/العلامة.";
      if (!productCategory.trim()) return "يرجى إدخال نوع المنتجات.";
      if (!storeLink.trim()) return "يرجى إدخال رابط صفحة المتجر.";
    }
    if (accountType === "small_business") {
      if (!projectName.trim()) return "يرجى إدخال اسم المشروع.";
      if (!projectField.trim()) return "يرجى إدخال المجال/التصنيف.";
      if (!projectStage) return "يرجى اختيار مرحلة المشروع.";
      if (!socialLink.trim()) return "يرجى إدخال رابط السوشال للمشروع.";
    }
    if (accountType === "delivery") {
      if (!companyName.trim()) return "يرجى إدخال اسم الشركة.";
      if (!deliveryScope) return "يرجى اختيار نطاق التوصيل.";
      if (!deliveryCities.trim()) return "يرجى إدخال المدن/المناطق.";
      if (!avgDeliveryTime.trim()) return "يرجى إدخال متوسط وقت التوصيل.";
      if (!licenseNo.trim()) return "يرجى إدخال رقم الترخيص.";
    }
    if (accountType === "supporter") {
      if (!supportType) return "يرجى اختيار نوع الدعم.";
      if (!fundingRange.trim()) return "يرجى إدخال نطاق التمويل/الدعم.";
      if (!interests.trim()) return "يرجى إدخال المجالات المهتم بها.";
      if (!professionalLink.trim()) return "يرجى إدخال رابط مهني.";
      if (!previousExperience.trim()) return "يرجى إدخال خبرة سابقة أو مشاريع تم دعمها.";
    }
    if (!proofLink1.trim() && !proofFile) return "يرجى إدخال رابط إثبات واحد على الأقل أو رفع ملف.";
    return "";
  };

  const goNext = () => {
    setErrorMsg(""); setSuccessMsg("");
    const err = validateStep1();
    if (err) { setErrorMsg(err); return; }
    setStep(2);
  };
  const goBack = () => { setErrorMsg(""); setSuccessMsg(""); setStep(1); };

  const buildTypeSpecificData = () => {
    if (accountType === "merchant") return {
      store_name: storeName.trim(),
      product_category: productCategory.trim(),
      store_link: storeLink.trim(),
      commercial_reg_no: commercialRegNo.trim() || null,
    };
    if (accountType === "small_business") return {
      project_name: projectName.trim(),
      project_field: projectField.trim(),
      project_stage: projectStage,
      needs,
      social_link: socialLink.trim(),
    };
    if (accountType === "delivery") return {
      company_name: companyName.trim(),
      delivery_scope: deliveryScope,
      delivery_cities: deliveryCities.trim(),
      avg_delivery_time: avgDeliveryTime.trim(),
      license_no: licenseNo.trim(),
    };
    return { // supporter
      support_type: supportType,
      funding_range: fundingRange.trim(),
      interests: interests.trim(),
      professional_link: professionalLink.trim(),
      previous_experience: previousExperience.trim(),
    };
  };

  const uploadFile = async (file: File, userId: string) => {
    const filePath = `${userId}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("documents").upload(filePath, file);
    if (error) throw error;
    const { data } = supabase.storage.from("documents").getPublicUrl(filePath);
    return data.publicUrl;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(""); setSuccessMsg("");
    const err = validateStep2();
    if (err) { setErrorMsg(err); return; }

    setLoading(true);

    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail, password,
      });
      if (signUpError) { setErrorMsg(signUpError.message); setLoading(false); return; }
      const userId = signUpData.user?.id;
      if (!userId) { setErrorMsg("تعذر إنشاء المستخدم."); setLoading(false); return; }

      // Insert profile
      const { error: profileError } = await supabase.from("profiles").insert({
        id: userId,
        full_name: fullName.trim(),
        phone: phone.trim(),
        country,
        city,
        account_type: accountType,
        status: "pending",
      });
      if (profileError) { setErrorMsg(profileError.message); setLoading(false); return; }

      // Upload file if exists
      let fileUrl: string | null = null;
      if (proofFile) fileUrl = await uploadFile(proofFile, userId);

      // Insert application
      const { error: appError } = await supabase.from("applications").insert({
        user_id: userId,
        account_type: accountType,
        data_json: { basic: { fullName, email, phone, country, city, accountType, bio }, type_specific: buildTypeSpecificData() },
        proof_json: { proof_link_1: proofLink1.trim() || null, proof_link_2: proofLink2.trim() || null, note: proofNote.trim() || null, file_upload: fileUrl },
        status: "pending",
      });
      if (appError) { setErrorMsg(appError.message); setLoading(false); return; }

      setSuccessMsg("تم إرسال الطلب بنجاح. الطلب قيد المراجعة من الإدارة.");
    } catch (err: any) { setErrorMsg("حدث خطأ غير متوقع."); }
    finally { setLoading(false); }
  };

  const needOptions = [
    { value: "suppliers", label: "موردين" },
    { value: "marketing", label: "تسويق" },
    { value: "funding", label: "تمويل" },
    { value: "partnerships", label: "شراكات" },
  ];

  const countries = ["فلسطين"];
  const cities = ["نابلس", "رام الله", "الخليل", "بيت لحم", "جنين"];

  return (
    <main className="min-h-screen bg-[#f8fafc]">
      <Navbar />
      <div className="flex justify-center items-center py-16 px-4">
        <div className="bg-white shadow-lg rounded-2xl p-8 w-full max-w-2xl border border-[#e6edf5]">
          <h1 className="text-2xl font-bold text-[#273347] mb-2 text-center">طلب إنشاء حساب</h1>
          <p className="text-center text-sm text-[#273347]/70 mb-6">
            بعد إدخال البيانات، سيتم مراجعة الطلب من الإدارة.
          </p>

          {errorMsg && <div className="mb-5 bg-red-50 text-red-700 border border-red-200 rounded-xl p-3 text-sm">{errorMsg}</div>}
          {successMsg && <div className="mb-5 bg-green-50 text-green-700 border border-green-200 rounded-xl p-3 text-sm">{successMsg}</div>}

          <form onSubmit={onSubmit} className="space-y-6">
            {step === 1 && (
              <section className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-[#273347] mb-2">الاسم الكامل</label>
                    <input value={fullName} onChange={e => setFullName(e.target.value)} className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]" placeholder="الاسم الكامل"/>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#273347] mb-2">نوع الحساب</label>
                    <select value={accountType} onChange={e => setAccountType(e.target.value as AccountType)} className="w-full border border-gray-300 rounded-xl p-3 bg-white focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]">
                      <option value="merchant">تاجر (جملة)</option>
                      <option value="small_business">مشروع صغير</option>
                      <option value="delivery">شركة توصيل</option>
                      <option value="supporter">داعِم / مستثمر</option>
                    </select>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-[#273347] mb-2">البريد الإلكتروني</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]" placeholder="name@email.com"/>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#273347] mb-2">كلمة المرور</label>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]" placeholder="••••••••"/>
                    <p className="mt-1 text-xs text-[#273347]/60">6 أحرف على الأقل، حرف كبير، حرف صغير، رقم ورمز</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-[#273347] mb-2">رقم الهاتف</label>
                    <input value={phone} onChange={e => setPhone(e.target.value)} className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]" placeholder="059xxxxxxx"/>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#273347] mb-2">الدولة</label>
                    <select value={country} onChange={e => setCountry(e.target.value)} className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]">
                      <option value="">اختر الدولة</option>
                      {countries.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#273347] mb-2">المدينة</label>
                    <select value={city} onChange={e => setCity(e.target.value)} className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]">
                      <option value="">اختر المدينة</option>
                      {cities.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#273347] mb-2">نبذة قصيرة (سطران)</label>
                  <textarea value={bio} onChange={e => setBio(e.target.value)} className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]" rows={3} placeholder="عرّف بشكل مختصر عن نشاطك..."/>
                </div>

                <div className="flex items-center justify-between gap-3 pt-2">
                  <p className="text-sm text-[#273347]/70">
                    لديك حساب؟ <Link href="/login" className="text-[#546a85] font-semibold hover:underline">تسجيل الدخول</Link>
                  </p>
                  <button type="button" onClick={goNext} className="bg-[#bbd0e4] hover:bg-[#a9c2d8] transition text-[#273347] font-semibold px-6 py-3 rounded-xl">التالي</button>
                </div>
              </section>
            )}

            {/* STEP 2 ستب 2 + إثبات + رفع ملف */}
            {step === 2 && (
              <section className="space-y-4">
                <h2 className="text-lg font-bold text-[#273347]">البيانات الإضافية والإثبات</h2>

                {/* Proof file upload */}
                <div>
                  <label className="block text-sm font-semibold text-[#273347] mb-2">رفع ملف إثبات (اختياري)</label>
                  <input type="file" onChange={e => setProofFile(e.target.files?.[0] || null)} className="w-full"/>
                </div>

                <div className="flex items-center justify-between pt-2 gap-3">
                  <button type="button" onClick={goBack} className="border border-gray-300 rounded-xl px-6 py-3">عودة</button>
                  <button type="submit" disabled={loading || !!successMsg} className="bg-[#bbd0e4] hover:bg-[#a9c2d8] text-[#273347] font-semibold px-6 py-3 rounded-xl">
                    {successMsg ? "طلبك قيد المراجعة" : "إرسال الطلب"}
                  </button>
                </div>
              </section>
            )}
          </form>
        </div>
      </div>
    </main>
  );
}