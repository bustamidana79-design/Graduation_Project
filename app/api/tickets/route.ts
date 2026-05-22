import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { analyzeTicketWithAI } from '@/app/services/aiService';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { notifyAdminsAboutSupportMessage } from '@/lib/services/support-notifications.service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("البيانات المستلمة في السيرفر:", body);

    const { user_id, subject, first_message, user_role } = body;

    // التحقق من صحة البيانات
    if (!user_id || !subject || !first_message || !user_role) {
      return NextResponse.json(
        { error: "البيانات غير مكتملة" },
        { status: 400 }
      );
    }

    // التحقق من صحة الـ user_id (يجب أن يكون UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89abAB][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(user_id)) {
      return NextResponse.json(
        { error: "معرف المستخدم غير صحيح" },
        { status: 400 }
      );
    }
    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .insert([{
        user_id,
        subject,
        user_role, 
        status: 'open',
        priority: 'medium',
        last_sender_type: 'user' // أضفنا هاد السطر عشان النقطة الحمراء تظهر فوراً
      }])
      .select()
      .single();

    if (ticketError) {
       console.error("خطأ سوبابيس (Tickets):", ticketError);
       return NextResponse.json(
         { error: "فشل في إنشاء التذكرة: " + ticketError.message },
         { status: 500 }
       );
    }

    // 2. إدخال أول رسالة في جدول الرسائل
    const { error: messageError } = await supabase
      .from('ticket_messages')
      .insert([{
        ticket_id: ticket.id,
        sender_id: user_id,
        message: first_message,
        sender_type: 'user'
      }]);

    if (messageError) {
        console.error("خطأ سوبابيس (Messages):", messageError);
        // حتى لو فشلت الرسالة، التذكرة تم إنشاؤها
        return NextResponse.json(
          { 
            ticket: ticket,
            warning: "التذكرة تم إنشاؤها لكن فشل إرسال الرسالة الأولى"
          },
          { status: 201 }
        );
    }

    // 3. تشغيل الـ AI لتحليل التذكرة وتوليد الـ Summary
    // ملاحظة: تأكدي أن هذه الدالة داخل aiService تقوم بتحديث عمود ai_summary في الداتابيز
    try {
      await notifyAdminsAboutSupportMessage(createSupabaseAdmin(), ticket, first_message);
    } catch (notificationError) {
      console.error("Support notification failed:", notificationError);
    }

    try {
        await analyzeTicketWithAI(ticket.id, subject, first_message);
    } catch (aiError) {
        console.error("AI Analysis Failed:", aiError);
        // لا نوقف العملية لو فشل الـ AI، المهم التذكرة انخزنت
    }

    return NextResponse.json({ 
      success: true, 
      ticketId: ticket.id, 
      message: "تم إنشاء التذكرة وجاري تلخيصها بواسطة الـ AI" 
    });

  } catch (error: any) {
    console.error("Error creating ticket:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
