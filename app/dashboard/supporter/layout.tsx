import SupporterSidebar from "./components/SupporterSidebar";

export default function SupporterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-[#f8fafc]" dir="rtl">
      <SupporterSidebar />
      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-[#e6edf5] px-6 py-4 flex items-center justify-end">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#273347] text-white flex items-center justify-center text-sm font-bold">
              د
            </div>
            <div className="text-sm text-right">
              <p className="font-semibold text-[#273347]">...</p>
              <p className="text-[#273347]/50 text-xs">داعم / مستثمر</p>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}