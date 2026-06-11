import Link from "next/link";
import CorexLogo from "@/components/CorexLogo";

export default function Hero() {
  return (
    <section className="bg-gradient-to-b from-[#546a85] to-[#273347] text-white">
      <div className="max-w-6xl mx-auto px-6 py-16 text-center animate-fade-in">
        <h1 className="flex justify-center drop-shadow">
          <CorexLogo className="h-28 w-full max-w-[620px] sm:h-36" />
        </h1>

      <p className="mt-4 text-white/90 max-w-2xl mx-auto">
  منصة ذكية تربط المشاريع الصغيرة بالموردين
   وشركات الشحن والمستثمرين. 
  <br />
  كل ما تحتاجه لإدارة وتنمية عملك في مكان واحد
</p>

        <div className="mt-8 flex justify-center gap-4 flex-wrap">
          <Link
            href="/login"
            className="bg-[#bbd0e4] text-[#273347] px-7 py-3 rounded-full font-semibold shadow-md hover:shadow-xl hover:scale-105 transition duration-200"
          >
            تسجيل الدخول
          </Link>

          <Link
            href="/register"
            className="bg-white/10 border border-white/30 px-7 py-3 rounded-full font-semibold hover:bg-white/15 transition duration-200"
          >
            إنشاء حساب جديد
          </Link>
        </div>
      </div>
    </section>
  );
}
