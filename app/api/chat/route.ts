import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "تم تعطيل هذا المسار. استخدم /api/chatbot؛ يتم تحديد الدور من المستخدم المسجل فقط.",
    },
    { status: 410 }
  );
}

export async function GET() {
  return NextResponse.json(
    {
      error: "تم تعطيل هذا المسار. استخدم /api/chatbot.",
    },
    { status: 410 }
  );
}
