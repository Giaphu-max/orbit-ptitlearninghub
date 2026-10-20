import { useEffect, useLayoutEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { MainLayout } from '@/layouts/MainLayout'
import { scrollToSection } from '@/lib/scroll'

/**
 * Cửa sổ trình duyệt là vùng cuộn duy nhất. Đổi trang thì cuộn về đầu ngay (useLayoutEffect: xong trước khi view transition chụp trang mới);
 * có #hash thì cuộn mượt tới phần tử đó (trang tải lười nên chờ phần tử xuất hiện tối đa ~3 giây). scroll-margin-top của .section-anchor chừa chỗ cho thanh nav.
 * Tôn trọng prefers-reduced-motion: khi bật thì nhảy thẳng.
 */
function ScrollManager() {
    const { pathname, hash } = useLocation()
    useLayoutEffect(() => {
        window.scrollTo(0, 0)
    }, [pathname])
    useEffect(() => {
        if (!hash) return
        const id = decodeURIComponent(hash.slice(1))
        let tries = 0
        let raf = 0
        const seek = () => {
            if (!scrollToSection(id) && tries++ < 180) raf = requestAnimationFrame(seek)
        }
        seek()
        return () => cancelAnimationFrame(raf)
    }, [pathname, hash])
    return null
}

export function Shell() {
    return (
        <>
            <ScrollManager />
            <MainLayout />
        </>
    )
}

export const Spinner = () => (
    <div className="flex min-h-[100svh] items-center justify-center text-muted-foreground">
        <Loader2 className="animate-spin" size={32} aria-label="Đang tải trang" />
    </div>
)

export function RouteError() {
    return (
        <div className="flex min-h-[100svh] flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-lg font-bold text-foreground">Trang chưa tải được. Bạn thử lại nhé.</p>
            <Link to="/" reloadDocument className="rounded-full bg-brand-600 px-6 py-3 text-sm font-bold text-ink-foreground shadow-brand">
                Về trang chủ
            </Link>
        </div>
    )
}

