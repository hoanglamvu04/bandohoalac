import { Map, Camera, Compass, MapPin, Trophy } from 'lucide-react';

const categories = ['Cafe', 'Ăn uống', 'Homestay', 'Villa', 'Check-in', 'Trải nghiệm'];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f7f3ea] text-[#102f29]">
      <section className="relative overflow-hidden bg-[#102f29] px-6 py-16 text-white">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center gap-3 text-[#f6c453]">
            <Map className="h-8 w-8" />
            <span className="font-semibold tracking-widest">HOLA MAPS</span>
          </div>
          <h1 className="mt-8 max-w-3xl text-5xl font-bold leading-tight">
            Khám phá Hòa Lạc cùng cộng đồng địa phương
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-white/80">
            Bản đồ trải nghiệm được xây dựng từ những địa điểm thật, ảnh thật và người khám phá thật.
          </p>
          <div className="mt-8 flex gap-4">
            <button className="rounded-full bg-[#f6c453] px-7 py-3 font-semibold text-[#102f29]">
              Mở bản đồ
            </button>
            <button className="rounded-full border border-white/30 px-7 py-3">
              Đóng góp địa điểm
            </button>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 py-10 md:grid-cols-3">
        {[
          [MapPin, 'Địa điểm thực tế', 'Khám phá nơi được cộng đồng xác minh'],
          [Camera, 'Ảnh cộng đồng', 'Chia sẻ trải nghiệm tại Hòa Lạc'],
          [Trophy, 'Explorer', 'Tích điểm và xây dựng uy tín']
        ].map(([Icon, title, text]) => (
          <div key={String(title)} className="rounded-3xl bg-white p-6 shadow-sm">
            <Icon className="h-8 w-8 text-[#b08a45]" />
            <h2 className="mt-5 text-xl font-bold">{title}</h2>
            <p className="mt-2 text-gray-600">{text}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <div className="flex items-center gap-3">
            <Compass />
            <h2 className="text-2xl font-bold">Khám phá theo danh mục</h2>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            {categories.map((item) => (
              <span key={item} className="rounded-full bg-[#f7f3ea] px-5 py-2">{item}</span>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
