import Link from "next/link";
import CorexLogo from "@/components/CorexLogo";

export default function Navbar() {
  return (
    <header className="bg-[#273347] text-white shadow-lg">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 md:py-6">
        <Link href="/" aria-label="CoreX" className="flex items-center">
          <CorexLogo className="h-9 w-28 sm:h-12 sm:w-40 md:h-14 md:w-48" />
        </Link>

        <nav className="flex items-center gap-3 text-sm sm:gap-6 sm:text-base md:text-lg">
          <Link href="/" className="transition duration-200 hover:text-[#bbd0e4]">
            الرئيسية
          </Link>

          <Link
            href="/login"
            className="rounded-lg bg-[#546a85] px-4 py-2 font-semibold transition duration-200 hover:bg-[#bbd0e4] hover:text-[#273347] sm:px-6 sm:py-2.5"
          >
            تسجيل الدخول
          </Link>
        </nav>
      </div>
    </header>
  );
}
