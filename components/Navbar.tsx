import Link from "next/link";

export default function Navbar() {
  return (
    <header className="bg-[#273347] text-white shadow-lg">
      <div className="max-w-6xl mx-auto px-6 py-5 md:py-6 flex items-center justify-between">

        {/* Brand */}
        <div className="flex items-center gap-2 font-bold text-2xl md:text-3xl tracking-wide">
          <h1>منصة الأعمال الذكية</h1>
        </div>

        {/* Links */}
        <nav className="flex items-center gap-6 text-base md:text-lg">
          <Link
            href="/"
            className="hover:text-[#bbd0e4] transition duration-200"
          >
            الرئيسية
          </Link>

          <Link
            href="/login"
            className="bg-[#546a85] px-6 py-2.5 rounded-lg font-semibold hover:bg-[#bbd0e4] hover:text-[#273347] transition duration-200"
          >
            تسجيل الدخول
          </Link>
        </nav>

      </div>
    </header>
  );
}