// Logo thật: đặt file src/assets/brand/logo.(svg|png|webp) là tự dùng; không có thì dùng khối chữ PTIT
const logoFiles = import.meta.glob('/src/assets/brand/logo.{svg,png,webp}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const LOGO_URL = Object.values(logoFiles)[0]

/** Khối logo PTIT vuông bo góc, dùng ở thanh điều hướng và footer. */
export function BrandLogo({ className = '' }: { className?: string }) {
    return LOGO_URL ? (
        <img src={LOGO_URL} alt="PTIT" className={`logo-mark h-10 w-10 shrink-0 rounded-xl object-contain p-1 ${className}`} />
    ) : (
        // Khối vuông trắng bo góc, chữ PTIT đỏ: nổi trên nền tối
        <span className={`logo-mark flex aspect-square h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[11px] font-black tracking-tight ${className}`}>PTIT</span>
    )
}
