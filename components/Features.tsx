import { features } from "../lib/features";

export default function Features() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-14">
      <h2 className="text-2xl sm:text-3xl font-bold text-center mb-10 text-[#273347]">
        لماذا تختار منصتنا؟
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((item) => (
          <div
            key={item.title}
            className="bg-white rounded-2xl border border-[#e6edf5] p-7 shadow-sm hover:shadow-lg hover:-translate-y-1 transition duration-300"
          >
            <div className="text-4xl">{item.icon}</div>
            <h3 className="mt-4 text-lg font-bold text-[#273347]">
              {item.title}
            </h3>
            <p className="mt-2 text-[#273347]/70 leading-relaxed text-sm">
              {item.desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}