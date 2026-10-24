import { LOGO_URL } from '@/lib/brand'

/** Ô logo PTIT trắng bo góc 44px, dùng ở thanh điều hướng và footer (data-brand-logo là đích bay của logo ở màn intro). */
export function BrandLogo({ className = '' }: { className?: string }) {
    return LOGO_URL ? (
        <img src={LOGO_URL} alt="PTIT" data-brand-logo className={`logo-mark h-11 w-11 shrink-0 rounded-xl object-contain p-1 ${className}`} />
    ) : (
        // Khối vuông trắng bo góc, chữ PTIT đỏ: nổi trên nền tối
        <span data-brand-logo className={`logo-mark flex aspect-square h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[11px] font-black tracking-tight ${className}`}>PTIT</span>
    )
}
