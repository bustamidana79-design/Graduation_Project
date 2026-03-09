"use client";

import Link from "next/link";
import Navbar from "../../components/Navbar";

export default function PendingPage() {
  return (
    <main className="min-h-screen bg-[#f8fafc]">
      <Navbar />

       {/* Main content */}
      <div className="flex justify-center items-center py-16 px-4">
        <div className="bg-white shadow-lg rounded-2xl p-10 w-full max-w-lg border border-[#e6edf5] text-center">

          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-[#bbd0e4]/30 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-10 h-10 text-[#546a85]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-[#273347] mb-3">
            طلبك قيد المراجعة
          </h1>

          {/* Description */}
          <p className="text-sm text-[#273347]/65 leading-relaxed mb-8">
            سيتم مراجعة بياناتك من قبل الإدارة.
            <br />
            سنتواصل معك عبر البريد الإلكتروني فور الانتهاء من المراجعة.
          </p>

          {/* Divider */}
          <div className="w-16 h-1 rounded-full bg-[#bbd0e4] mx-auto mb-8" />

        

        </div>
      </div>
    </main>
  );
}