import { Link } from 'react-router-dom'
import { ArrowRight, Camera, Sparkles } from 'lucide-react'
import { SectionHeading } from '@/components/section-heading'
import studioDefault from '@/assets/studio-default.webp'
import studioSunset from '@/assets/studio-sunset.webp'

/** Giới thiệu Studio 3D bằng ảnh tĩnh chụp từ studio thật (không dựng thêm cảnh 3D thứ hai trên trang chủ). */
export function StudioSection() {
    return (
        <section id="studio" aria-labelledby="studio-title" className="section-anchor">
            <SectionHeading id="studio-title" eyebrow="Studio 3D" title="Tả ánh sáng. Rồi chụp." />

            <div className="mt-7 grid items-center gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-12">
                <div className="flex flex-col gap-6">
                    <Feature icon={<Camera size={20} />} title="Virtual Director">
                        Đặt máy, chỉnh tiêu cự, góc và ba đèn trong studio ảo, rồi chụp. AI chấm bố cục và ánh sáng, khoanh đúng vùng cần chỉnh.
                    </Feature>
                    <Feature icon={<Sparkles size={20} />} title="Prompt-to-Environment">
                        Gõ “hoàng hôn gắt, bóng đổ dài”. AI bố trí đèn, màu nền, sương và giải thích vì sao chọn như vậy theo lý thuyết nhiếp ảnh.
                    </Feature>
                    <div>
                        <Link to="/studio" className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-7 py-3.5 text-sm font-bold text-ink-foreground shadow-brand transition hover:bg-brand-700">
                            Vào Studio <ArrowRight size={16} />
                        </Link>
                    </div>
                </div>

                <figure className="relative aspect-[3/2] overflow-hidden rounded-panel bg-ink shadow-raised">
                    <img src={studioSunset} alt="Cảnh studio sau khi AI bố trí ánh sáng hoàng hôn gắt: đèn thấp, bóng đổ dài" loading="lazy" className="h-full w-full object-cover" />
                    <p className="absolute left-4 top-4 inline-flex max-w-[85%] items-center gap-2 rounded-full bg-ink/80 px-4 py-2 text-[13px] font-semibold text-ink-foreground backdrop-blur">
                        <Sparkles size={14} className="shrink-0 text-brand-light" /> “Hoàng hôn gắt, bóng đổ dài”
                    </p>
                    <div className="absolute bottom-4 left-4 w-[30%] overflow-hidden rounded-xl border-2 border-ink-foreground/70 shadow-raised">
                        <img src={studioDefault} alt="Cảnh studio mặc định trước khi mô tả ánh sáng" loading="lazy" className="block w-full" />
                        <figcaption className="absolute inset-x-0 bottom-0 bg-ink/75 px-2 py-1 text-[11px] font-bold text-ink-foreground">Ban đầu</figcaption>
                    </div>
                </figure>
            </div>
        </section>
    )
}

function Feature({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
    return (
        <div className="flex gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand-ink">{icon}</span>
            <div>
                <h3 className="text-lg font-extrabold tracking-tight text-foreground">{title}</h3>
                <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">{children}</p>
            </div>
        </div>
    )
}
