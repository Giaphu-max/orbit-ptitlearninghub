// Hiệu ứng chuyển sáng/tối lấy logo PTIT làm tâm: logo hiện giữa màn hình, vòng đỏ xoay,
// một vòng tròn lan từ tâm logo để lộ giao diện mới (View Transitions API), logo mờ dần.
// Tổng < 1 giây, không chặn thao tác; bấm liên tiếp thì hủy lượt trước và chạy lượt mới.

const TOTAL_MS = 900
const REVEAL_DELAY_MS = 120
const REVEAL_MS = 600

const logoUrls = import.meta.glob('/src/assets/brand/logo.{svg,png,webp}', {
    eager: true,
    query: '?url',
    import: 'default',
}) as Record<string, string>
const logoUrl = Object.values(logoUrls)[0]

type VTDocument = Document & {
    startViewTransition?: (cb: () => void) => { ready: Promise<void>; finished: Promise<void>; skipTransition: () => void }
}

let current: { cleanup: () => void } | null = null

const buildOverlay = () => {
    const el = document.createElement('div')
    el.setAttribute('aria-hidden', 'true')
    el.style.cssText =
        'position:fixed;left:50%;top:50%;width:140px;height:140px;margin:-70px 0 0 -70px;z-index:9999;' +
        'pointer-events:none;display:grid;place-items:center;opacity:0;view-transition-name:orbit-logo;'

    const ring = document.createElement('div')
    ring.style.cssText =
        'position:absolute;inset:0;border-radius:9999px;border:3px solid hsl(var(--ink-foreground) / 0.25);' +
        'border-top-color:hsl(var(--brand-light, 358 90% 68%));border-right-color:hsl(var(--brand-light, 358 90% 68%));'
    const mark = document.createElement('div')
    mark.style.cssText =
        'width:84px;height:84px;border-radius:20px;display:grid;place-items:center;overflow:hidden;' +
        'background:hsl(var(--ink-foreground));color:hsl(var(--brand-ink));' +
        'font:800 26px/1 "Be Vietnam Pro",system-ui,sans-serif;letter-spacing:0.02em;box-shadow:0 12px 40px hsl(0 0% 0% / 0.35);'
    if (logoUrl) {
        const img = document.createElement('img')
        img.src = logoUrl
        img.alt = ''
        img.style.cssText = 'width:70%;height:70%;object-fit:contain'
        mark.append(img)
    } else {
        mark.textContent = 'PTIT'
    }
    el.append(ring, mark)
    document.body.append(el)
    return { el, ring }
}

export function runThemeTransition(apply: () => void) {
    const interrupted = current !== null
    current?.cleanup()
    current = null

    const doc = document as VTDocument
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // Bấm dồn: bỏ qua View Transition của lượt trước, đổi ngay để không bao giờ kẹt trạng thái
    if (reduced || interrupted) {
        apply()
        if (reduced) return
    }

    const root = document.documentElement
    const { el, ring } = buildOverlay()
    const anims: Animation[] = []
    let vt: ReturnType<NonNullable<VTDocument['startViewTransition']>> | undefined
    let fadeTimer = 0

    const cleanup = () => {
        anims.forEach((a) => a.cancel())
        el.remove()
        window.clearTimeout(fadeTimer)
        window.clearTimeout(safety)
        root.classList.remove('theme-fade')
        vt?.skipTransition()
        if (current?.cleanup === cleanup) current = null
    }
    current = { cleanup }

    // Logo: hiện + phóng nhẹ, rồi mờ dần ở cuối
    anims.push(
        el.animate(
            [
                { opacity: 0, transform: 'scale(0.8)', offset: 0 },
                { opacity: 1, transform: 'scale(1)', offset: 0.2 },
                { opacity: 1, transform: 'scale(1.08)', offset: 0.65 },
                { opacity: 0, transform: 'scale(1.15)', offset: 1 },
            ],
            { duration: TOTAL_MS, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' },
        ),
        ring.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(540deg)' }], {
            duration: TOTAL_MS,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
        }),
    )
    anims[0].finished.then(cleanup).catch(() => {})
    const safety = window.setTimeout(cleanup, TOTAL_MS + 300)

    if (interrupted) {
        // đã đổi ngay ở trên; chỉ giữ logo + vòng xoay
    } else if (doc.startViewTransition) {
        const x = window.innerWidth / 2
        const y = window.innerHeight / 2
        const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
        vt = doc.startViewTransition(apply)
        vt.ready
            .then(() => {
                anims.push(
                    root.animate(
                        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
                        {
                            duration: REVEAL_MS,
                            delay: REVEAL_DELAY_MS,
                            easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
                            fill: 'both',
                            pseudoElement: '::view-transition-new(root)',
                        },
                    ),
                )
            })
            .catch(() => {})
    } else {
        // Trình duyệt chưa hỗ trợ: đổi giao diện bằng fade
        root.classList.add('theme-fade')
        apply()
        fadeTimer = window.setTimeout(() => root.classList.remove('theme-fade'), TOTAL_MS)
    }
}
