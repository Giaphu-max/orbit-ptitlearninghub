/** Tiêu đề phần dùng chung cho trang chủ: dòng nhỏ viết hoa + tiêu đề lớn đậm, cùng phong cách "Đọc ngắn. Rồi nghỉ.". */
export function SectionHeading({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children?: React.ReactNode }) {
    return (
        <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
                <p className="text-eyebrow uppercase text-brand-ink">{eyebrow}</p>
                <h2 id={id} className="mt-2 text-[clamp(2rem,4.6vw,3.25rem)] font-black leading-none tracking-[-0.04em] text-foreground">
                    {title}
                </h2>
            </div>
            {children}
        </div>
    )
}
