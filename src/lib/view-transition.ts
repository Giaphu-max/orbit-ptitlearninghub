import { curtainPlaying } from '@/lib/theme-switch'

// Chuyển trang bằng View Transitions API (react-router 7 gọi document.startViewTransition khi navigate có viewTransition).
// Quy tắc: bấm thẻ Daily / thẻ bài học → thẻ morph thành header bài đọc / khung video (view-transition-name theo id);
// vào Studio / Khóa học → fade + trượt nhẹ 12px; mọi chuyển trang khác → cross-fade 220ms (CSS ở index.css).
// Trình duyệt không hỗ trợ, hoặc prefers-reduced-motion, hoặc đang chạy màn phủ đổi giao diện/vai trò: điều hướng bình thường.

type Kind = 'morph' | 'slide' | 'fade'

/** Chỉ cần phần navigate của router; kiểu rộng để không phụ thuộc nội bộ react-router. */
interface Navigable {
    navigate: (to: unknown, opts?: Record<string, unknown>) => Promise<void>
}

const CLEAR_MS = 1500

let lastCard: HTMLElement | null = null
let lastClickAt = 0

const supported = () => typeof document !== 'undefined' && 'startViewTransition' in document

function targetPath(to: unknown): string | null {
    if (typeof to === 'string') return new URL(to, window.location.href).pathname
    if (to && typeof to === 'object') return (to as { pathname?: string }).pathname ?? window.location.pathname
    return null
}

function kindFor(path: string): { kind: Kind; mark?: () => void } {
    // Nút "Vào Studio" ở chương cuối trang chủ: sân khấu 3D toàn màn hình morph thành khung studio (cùng góc máy)
    if (path === '/studio' && lastCard?.dataset.vt === 'studio-stage' && performance.now() - lastClickAt < 800) {
        return {
            kind: 'morph',
            mark: () => {
                const stage = document.getElementById('home-stage')
                if (!stage) return
                stage.style.viewTransitionName = 'vt-studio-stage'
                window.setTimeout(() => (stage.style.viewTransitionName = ''), CLEAR_MS)
            },
        }
    }
    if (path === '/studio' || path === '/learning') return { kind: 'slide' }
    const m = path.match(/^\/(daily|lesson)\/([^/]+)$/)
    if (m && lastCard && performance.now() - lastClickAt < 800 && lastCard.dataset.vt === `${m[1]}-${decodeURIComponent(m[2])}`) {
        const card = lastCard
        // Đặt tên cho đúng thẻ vừa bấm (hero và danh sách khóa có thể cùng trỏ tới một bài); trang đích đặt cùng tên
        return {
            kind: 'morph',
            mark: () => {
                // Thẻ có phần tử data-vt-thumb (trạm bài trên bản đồ chặng) thì chỉ ảnh thumbnail morph thành khung video
                const target = card.querySelector<HTMLElement>('[data-vt-thumb]') ?? card
                target.style.viewTransitionName = `vt-${card.dataset.vt}`
                window.setTimeout(() => (target.style.viewTransitionName = ''), CLEAR_MS)
            },
        }
    }
    return { kind: 'fade' }
}

/** Bọc router.navigate: mọi lần đổi trang (khác pathname) chạy trong view transition. Link và useNavigate đều đi qua đây. */
export function installViewTransitions(router: Navigable) {
    if (!supported()) return
    document.addEventListener(
        'click',
        (e) => {
            lastCard = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-vt]') : null
            lastClickAt = performance.now()
        },
        true,
    )
    const base = router.navigate.bind(router)
    router.navigate = (to, opts) => {
        const path = typeof to === 'number' ? null : targetPath(to)
        const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        if (path === null || path === window.location.pathname || calm || curtainPlaying() || opts?.viewTransition === false) return base(to, opts)
        const { kind, mark } = kindFor(path)
        mark?.()
        const root = document.documentElement
        root.dataset.vt = kind
        window.setTimeout(() => {
            if (root.dataset.vt === kind) delete root.dataset.vt
        }, CLEAR_MS)
        return base(to, { ...opts, viewTransition: true })
    }
}
