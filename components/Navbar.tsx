import Link from "next/link";

export default function Navbar() {
  return (
    <header className="bg-[#273347] text-white shadow-lg">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 md:py-6">
        <div className="flex items-center gap-2 text-2xl font-bold tracking-wide md:text-3xl">
          <h1>منصة الأعمال الذكية</h1>
        </div>

        <nav className="flex items-center gap-6 text-base md:text-lg">
          <Link href="/" className="transition duration-200 hover:text-[#bbd0e4]">
            الرئيسية
          </Link>

          <Link
            href="/login"
            className="rounded-lg bg-[#546a85] px-6 py-2.5 font-semibold transition duration-200 hover:bg-[#bbd0e4] hover:text-[#273347]"
          >
            تسجيل الدخول
          </Link>
        </nav>
      </div>
    </header>
  );
}
