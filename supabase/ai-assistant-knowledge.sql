create table if not exists public.ai_chat_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists ai_chat_sessions_profile_idx
  on public.ai_chat_sessions (profile_id, created_at desc);

create table if not exists public.ai_chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.ai_chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_chat_messages_session_idx
  on public.ai_chat_messages (session_id, created_at);

create table if not exists public.ai_knowledge_base (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  category text,
  account_type text not null default 'all'
    check (account_type in ('all', 'merchant', 'small_business', 'delivery', 'supporter', 'admin')),
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_knowledge_base_account_type_idx
  on public.ai_knowledge_base (account_type, is_active);

create index if not exists ai_knowledge_base_category_idx
  on public.ai_knowledge_base (category);

create unique index if not exists ai_knowledge_base_seed_unique_idx
  on public.ai_knowledge_base (lower(title), account_type);

alter table public.ai_chat_messages
  add column if not exists rating smallint check (rating in (-1, 1)),
  add column if not exists feedback_note text,
  add column if not exists rated_at timestamptz;

create index if not exists ai_chat_messages_rating_idx
  on public.ai_chat_messages (rating)
  where rating is not null;

alter table public.ai_chat_sessions enable row level security;
alter table public.ai_chat_messages enable row level security;
alter table public.ai_knowledge_base enable row level security;

drop policy if exists "Users can read their chat sessions" on public.ai_chat_sessions;
create policy "Users can read their chat sessions"
  on public.ai_chat_sessions
  for select
  to authenticated
  using (profile_id = auth.uid());

drop policy if exists "Users can create their chat sessions" on public.ai_chat_sessions;
create policy "Users can create their chat sessions"
  on public.ai_chat_sessions
  for insert
  to authenticated
  with check (profile_id = auth.uid());

drop policy if exists "Users can read their chat messages" on public.ai_chat_messages;
create policy "Users can read their chat messages"
  on public.ai_chat_messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.ai_chat_sessions
      where ai_chat_sessions.id = ai_chat_messages.session_id
        and ai_chat_sessions.profile_id = auth.uid()
    )
  );

drop policy if exists "Users can create messages in their chat sessions" on public.ai_chat_messages;
create policy "Users can create messages in their chat sessions"
  on public.ai_chat_messages
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.ai_chat_sessions
      where ai_chat_sessions.id = ai_chat_messages.session_id
        and ai_chat_sessions.profile_id = auth.uid()
    )
  );

drop policy if exists "Authenticated users can read active knowledge" on public.ai_knowledge_base;
create policy "Authenticated users can read active knowledge"
  on public.ai_knowledge_base
  for select
  to authenticated
  using (is_active = true);

drop policy if exists "Admins can manage knowledge" on public.ai_knowledge_base;
create policy "Admins can manage knowledge"
  on public.ai_knowledge_base
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.account_type = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.account_type = 'admin'
    )
  );

drop policy if exists "Users can rate their assistant messages" on public.ai_chat_messages;
create policy "Users can rate their assistant messages"
  on public.ai_chat_messages
  for update
  to authenticated
  using (
    role = 'assistant'
    and exists (
      select 1
      from public.ai_chat_sessions
      where ai_chat_sessions.id = ai_chat_messages.session_id
        and ai_chat_sessions.profile_id = auth.uid()
    )
  )
  with check (
    role = 'assistant'
    and exists (
      select 1
      from public.ai_chat_sessions
      where ai_chat_sessions.id = ai_chat_messages.session_id
        and ai_chat_sessions.profile_id = auth.uid()
    )
  );

insert into public.ai_knowledge_base (title, content, category, account_type)
values
  (
    'قواعد عامة لردود المساعد',
    'يجب أن تكون الردود بالعربية، عملية، مختصرة عند الحاجة، وتحتوي على خطوات أو أمثلة جاهزة. لا يقدم المساعد قرارات مالية أو إدارية نهائية، بل توصيات إرشادية تحتاج مراجعة بشرية.',
    'general',
    'all'
  ),
  (
    'خطة محتوى أسبوعية لمشروع صغير',
    'اقترح خطة من 5 أيام: يوم للتعريف بالمنتج، يوم لفائدة أو مشكلة يحلها المنتج، يوم لكواليس العمل، يوم لعرض أو شهادة عميل، ويوم لدعوة مباشرة للطلب. يجب أن تشمل الخطة فكرة المنشور، النص المقترح، والدعوة لاتخاذ إجراء.',
    'marketing',
    'small_business'
  ),
  (
    'تحسين وصف المنتج للتاجر',
    'وصف المنتج الجيد يذكر المشكلة التي يحلها، أهم 3 فوائد، المواصفات الأساسية، طريقة الاستخدام، ولمن يناسب. يجب أن يكون الوصف واضحاً ويبتعد عن المبالغة غير المثبتة.',
    'product_copy',
    'merchant'
  ),
  (
    'رد شركة الشحن عند التأخير',
    'عند وجود تأخير، يجب الاعتذار بوضوح، ذكر أن الطلب قيد المتابعة، إعطاء موعد تقريبي إن توفر، وتقديم طريقة تواصل. مثال: نعتذر عن التأخير، طلبك قيد المتابعة حالياً وسنحدثك فور وصول تحديث من فريق التوصيل.',
    'customer_service',
    'delivery'
  ),
  (
    'تقييم مشروع قبل الدعم',
    'قبل دعم مشروع صغير، راجع وضوح الفكرة، وجود طلب حقيقي، قدرة صاحب المشروع على التنفيذ، تكلفة التشغيل، خطة التسويق، والمخاطر. المساعد يعطي أسئلة تقييم ولا يصدر قرار دعم نهائي.',
    'support_evaluation',
    'supporter'
  ),
  (
    'ملاحظات قبول أو رفض طلب تسجيل',
    'ملاحظات الإدارة يجب أن تكون مهنية، واضحة، وغير جارحة. في الرفض اذكر السبب القابل للتعديل إن وجد. في القبول اذكر الخطوة التالية بوضوح.',
    'admin_review',
    'admin'
  )
on conflict do nothing;

insert into public.ai_knowledge_base (title, content, category, account_type)
values
  (
    'قالب بوست إطلاق منتج',
    'قالب مناسب لإطلاق منتج: ابدأ بجملة تجذب الانتباه، ثم اذكر المشكلة التي يحلها المنتج، ثم 3 فوائد واضحة، ثم السعر أو طريقة الطلب إن توفرت، واختم بدعوة مباشرة مثل: اطلبيه الآن أو راسلينا لمعرفة التفاصيل.',
    'marketing',
    'merchant'
  ),
  (
    'قالب Bio لحساب مشروع صغير',
    'الـ Bio الجيد يوضح ماذا يبيع المشروع، لمن يخدم، ما نقطة قوته، وكيف يطلب العميل. مثال البنية: منتجات منزلية طازجة | طلبات داخل المدينة | تجهيز حسب الطلب | للحجز راسلنا على الخاص.',
    'social_media',
    'small_business'
  ),
  (
    'أفكار Reels لمشروع صغير',
    'اقترح أفكار Reels قصيرة مثل: قبل وبعد، طريقة التغليف، كواليس التحضير، رأي عميل، مقارنة بين منتجين، أكثر سؤال يتكرر، وتجربة المنتج خلال 15 ثانية. يجب أن تكون الفكرة قابلة للتنفيذ بموبايل وبدون إنتاج مكلف.',
    'social_media',
    'small_business'
  ),
  (
    'خطة تسويق بميزانية قليلة',
    'عند ضعف الميزانية ركز على محتوى عضوي، تعاونات صغيرة، عروض محدودة، إعادة نشر آراء العملاء، تحسين الصور، وجدولة منشورات ثابتة. لا تقترح إعلانات مدفوعة كبيرة إلا إذا طلب المستخدم ذلك أو ذكر ميزانية واضحة.',
    'marketing',
    'all'
  ),
  (
    'تحسين السعر والعروض',
    'عند اقتراح سعر أو عرض، اطلب أو استخدم تكلفة المنتج، تكلفة التغليف، التوصيل، هامش الربح، وسعر السوق. إن لم تتوفر الأرقام، قدم طريقة حساب عامة ولا تعط سعراً نهائياً على أنه مؤكد.',
    'pricing',
    'merchant'
  ),
  (
    'اختيار مورد مناسب',
    'عند مساعدة صاحب مشروع في اختيار مورد، ركز على جودة المنتج، الحد الأدنى للطلب، سرعة التوريد، وضوح الأسعار، سياسة الاستبدال، تقييمات العملاء، ومناسبة المنتج لهوية المشروع.',
    'suppliers',
    'small_business'
  ),
  (
    'رسالة تواصل مع مورد',
    'قالب رسالة لمورد: مرحباً، أنا صاحب مشروع وأرغب بمعرفة تفاصيل منتجاتكم. أحتاج قائمة الأسعار، الحد الأدنى للطلب، مدة التجهيز، خيارات التوصيل، وهل يوجد عينات أو صور حقيقية للمنتجات؟ شكراً لكم.',
    'suppliers',
    'small_business'
  ),
  (
    'رد على عميل غاضب',
    'عند الرد على عميل غاضب: اعتذر أولاً، أظهر تفهمك، اسأل عن رقم الطلب أو التفاصيل، اشرح الخطوة التالية، ولا تدخل في جدال. مثال: نعتذر جداً عن التجربة، حقك علينا. أرسل لنا رقم الطلب وسنتابع المشكلة فوراً.',
    'customer_service',
    'all'
  ),
  (
    'رد على سؤال السعر',
    'عند سؤال العميل عن السعر، يجب أن يكون الرد واضحاً ويشجع على الطلب. مثال: السعر هو X، والمنتج يشمل Y. إذا أحببت، أقدر أساعدك تختار الخيار الأنسب حسب حاجتك.',
    'customer_service',
    'merchant'
  ),
  (
    'تسويق خدمات شركة الشحن',
    'شركة الشحن يجب أن تركز في تسويقها على السرعة، الالتزام، التغطية الجغرافية، تتبع الطلبات، التعامل مع المرتجعات، وخدمة العملاء. الرسائل التسويقية يجب أن تخاطب التجار والمشاريع الصغيرة بلغة عملية.',
    'delivery_marketing',
    'delivery'
  ),
  (
    'عرض تعاون لشركة شحن مع متجر',
    'قالب عرض لشركة شحن: نقدم لكم خدمة توصيل منتظمة لطلبات متجركم مع متابعة للطلبات، أسعار واضحة، وتواصل سريع عند أي مشكلة. يمكننا البدء بفترة تجربة قصيرة لقياس جودة الخدمة.',
    'delivery_marketing',
    'delivery'
  ),
  (
    'تقليل شكاوى التوصيل',
    'لتقليل شكاوى التوصيل: وضح مدة التوصيل قبل الطلب، أرسل تحديثات عند التأخير، وفر رقم متابعة، درب فريق الدعم على الاعتذار والحلول، وسجل أسباب التأخير المتكررة لتحسين الخدمة.',
    'delivery_operations',
    'delivery'
  ),
  (
    'أسئلة قبل دعم مشروع',
    'أسئلة مهمة للداعم: ما المشكلة التي يحلها المشروع؟ من العملاء المستهدفون؟ ما تكلفة التشغيل؟ كيف سيصل المشروع للعملاء؟ ما المخاطر؟ ما الدليل أن هناك طلباً حقيقياً؟ وكيف سيستخدم الدعم؟',
    'support_evaluation',
    'supporter'
  ),
  (
    'رسالة داعم لصاحب مشروع',
    'قالب رسالة للداعم: مرحباً، اطلعت على مشروعك وأرغب بفهمه أكثر. هل يمكنك توضيح حجم الطلب الحالي، التكاليف الأساسية، خطة التسويق، وكيف سيساعدك الدعم في تطوير المشروع؟',
    'support_communication',
    'supporter'
  ),
  (
    'تلخيص طلب تسجيل للإدارة',
    'عند تلخيص طلب تسجيل، اذكر نوع الحساب، فكرة المشروع أو الخدمة، البيانات الناقصة، نقاط القوة، المخاطر أو علامات المراجعة، واقتراح أولي: قبول، رفض، أو طلب معلومات إضافية.',
    'admin_review',
    'admin'
  ),
  (
    'سبب رفض مهني',
    'سبب الرفض يجب أن يكون واضحاً وقابلاً للفهم. مثال: نعتذر عن قبول الطلب حالياً لأن المعلومات المقدمة غير كافية للتحقق من نشاط المشروع. يمكنك إعادة التقديم مع تفاصيل أوضح وصور أو روابط داعمة.',
    'admin_review',
    'admin'
  ),
  (
    'سبب قبول مهني',
    'سبب القبول يجب أن يكون مختصراً ومهنياً. مثال: تم قبول الطلب لأن البيانات الأساسية واضحة ومتوافقة مع متطلبات المنصة. يمكنك الآن استكمال ملفك وإضافة المنتجات أو الخدمات.',
    'admin_review',
    'admin'
  ),
  (
    'حدود المساعد الذكي',
    'المساعد يقدم اقتراحات وتسويق وصياغة ومساعدة عامة، لكنه لا يستبدل القرار البشري في القبول والرفض والدعم المالي والأسعار النهائية. يجب توضيح ذلك عند الأسئلة الحساسة.',
    'general',
    'all'
  )
on conflict do nothing;
