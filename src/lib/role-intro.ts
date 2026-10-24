// Intro sau khi chọn / đổi vai trò (theo docs/mockup/ptit-login/ptit-role-select.html).
// Khoảng 3,6s: màn đỏ lan từ thẻ vừa bấm → elip trắng vẽ dần → đĩa logo → vệt sáng → chữ → thoát (đổi vai + chuyển trang
// phía sau màn, đĩa logo bay vào ô logo ở header, màn đỏ mở bằng lỗ tròn). Bấm / Enter / Esc nhảy thẳng tới bước thoát.
// Chỉ animate transform / opacity / clip-path / mask bằng Web Animations API; huỷ hết animation và timer khi xong hoặc unmount.

export interface IntroRefs {
    root: HTMLElement
    red: HTMLElement
    rings: SVGElement
    r1: SVGElement
    r2: SVGElement
    badge: HTMLElement
    shine: HTMLElement
    glint: HTMLElement
    w1: HTMLElement
    w2: HTMLElement
    w3: HTMLElement
    skip: HTMLElement
    bar: HTMLElement
}

const E = {
    out: 'cubic-bezier(.22,1,.36,1)',
    inOut: 'cubic-bezier(.65,0,.35,1)',
    hole: 'cubic-bezier(.55,0,.75,.2)',
}

let refs: IntroRefs | null = null
let active = false
let abort: (() => void) | null = null

export const bindIntro = (r: IntroRefs | null) => {
    if (!r) abort?.()
    refs = r
}
export const introReady = () => refs !== null
/** Intro đang chạy: không chạy chồng hai lần, không cho đổi giao diện chen vào. */
export const introPlaying = () => active

const wait = (ms: number) => new Promise<void>((res) => setTimeout(res, ms))
const logoEl = () => document.querySelector<HTMLElement>('[data-brand-logo]')

/** Chờ ô logo ở header có mặt (sau khi đổi vai + chuyển trang), không bao giờ treo quá `limit` ms. */
async function waitLogo(limit = 900) {
    const t0 = performance.now()
    while (!logoEl() && performance.now() - t0 < limit) await wait(16)
    return logoEl()
}

export interface IntroHooks {
    /** Đổi vai + chuyển trang; gọi khi màn đỏ đã che kín. */
    swap: () => void
}

export function playRoleIntro(origin: { x: number; y: number }, greeting: string, hooks: IntroHooks): Promise<void> {
    const r = refs
    if (!r || active) {
        hooks.swap()
        return Promise.resolve()
    }
    const { root, red, rings, r1, r2, badge, shine, glint, w1, w2, w3, skip, bar } = r
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const W = window.innerWidth
    const H = window.innerHeight
    const R = Math.hypot(Math.max(origin.x, W - origin.x), Math.max(origin.y, H - origin.y)) + 20
    const maskOk = typeof CSS !== 'undefined' && 'registerProperty' in CSS

    const anims: Animation[] = []
    const timers: number[] = []
    const A = (el: Element, kf: Keyframe[], o: KeyframeAnimationOptions) => {
        const a = el.animate(kf, { fill: 'both', easing: E.out, ...o })
        anims.push(a)
        return a
    }

    let exited = false
    let finished = false
    let logo: HTMLElement | null = null
    let resolve!: () => void
    const done = new Promise<void>((res) => (resolve = res))

    const finish = () => {
        if (finished) return
        finished = true
        timers.forEach(clearTimeout)
        anims.forEach((a) => a.cancel())
        root.removeEventListener('click', onSkip)
        window.removeEventListener('keydown', onKey, true)
        root.classList.remove('on')
        root.setAttribute('aria-hidden', 'true')
        red.classList.remove('hole')
        for (const p of ['--hole', '--hx', '--hy']) red.style.removeProperty(p)
        ;(logoEl() ?? logo)?.style.removeProperty('opacity')
        active = false
        abort = null
        resolve()
    }

    const exit = async () => {
        if (exited || finished) return
        exited = true
        timers.forEach(clearTimeout)
        timers.length = 0
        hooks.swap()
        logo = await waitLogo()
        if (finished) return
        const cx = logo ? logo.getBoundingClientRect().left + logo.getBoundingClientRect().width / 2 : 56
        const cy = logo ? logo.getBoundingClientRect().top + logo.getBoundingClientRect().height / 2 : 40
        const Rc = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) + 20
        if (logo) logo.style.opacity = '0'

        // Đĩa logo bay (FLIP) vào đúng ô logo; logo trong đĩa phóng lên cho khớp phần đệm của ô
        const b = badge.getBoundingClientRect()
        const t = logo?.getBoundingClientRect()
        const dx = t ? t.left + t.width / 2 - (b.left + b.width / 2) : 0
        const dy = t ? t.top + t.height / 2 - (b.top + b.height / 2) : 0
        const s = t ? t.width / b.width : 0.2
        const fly = A(
            badge,
            [
                { transform: 'translate(-50%,-50%) scale(1)', borderRadius: '50%' },
                { transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(${s})`, borderRadius: '27%' },
            ],
            { duration: 650, easing: E.inOut },
        )
        const img = badge.querySelector('img')
        if (img) A(img, [{ transform: 'scale(1)' }, { transform: 'scale(1.32)' }], { duration: 650, easing: E.inOut })
        for (const el of [w1, w2, w3, skip]) A(el, [{ opacity: Number(getComputedStyle(el).opacity) }, { opacity: 0 }], { duration: 250 })
        A(
            rings,
            [
                { opacity: 0.35, transform: 'translate(-50%,-50%) rotate(-24deg) scale(1)' },
                { opacity: 0, transform: 'translate(-50%,-50%) rotate(10deg) scale(1.6)' },
            ],
            { duration: 650 },
        )

        // Màn đỏ: lỗ tròn lớn dần từ tâm ô logo (nếu trình duyệt không animate được thuộc tính tùy biến thì mờ đi)
        red.style.setProperty('--hx', `${cx}px`)
        red.style.setProperty('--hy', `${cy}px`)
        let open: Animation
        if (maskOk) {
            red.classList.add('hole')
            open = A(red, [{ '--hole': '0px' }, { '--hole': `${Rc}px` }], { duration: 650, delay: 250, easing: E.hole })
            A(red, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, delay: 780 })
        } else {
            open = A(red, [{ opacity: 1 }, { opacity: 0 }], { duration: 450, delay: 450 })
        }
        // Trang chủ nhận lời chào: chip XP đếm lên khi lỗ tròn vừa mở
        timers.push(window.setTimeout(() => window.dispatchEvent(new Event('orbit:intro-landed')), 700))

        await Promise.race([Promise.all([fly.finished, open.finished]).catch(() => undefined), wait(1600)])
        finish()
    }

    // Bỏ qua: nhảy tới cuối bước vào rồi thoát (vẫn bay vào logo, không cắt cụt)
    function onSkip() {
        if (exited || finished) return
        timers.forEach(clearTimeout)
        timers.length = 0
        anims.forEach((a) => a.finish())
        void exit()
    }
    function onKey(e: KeyboardEvent) {
        if (e.key === 'Enter' || e.key === 'Escape') {
            e.preventDefault()
            e.stopPropagation()
            onSkip()
        }
    }

    active = true
    abort = finish
    w3.textContent = greeting
    root.classList.add('on')
    root.setAttribute('aria-hidden', 'false')
    root.addEventListener('click', onSkip)
    window.addEventListener('keydown', onKey, true)

    if (reduce) {
        // Giảm chuyển động: chỉ mờ vào / mờ ra 0,3s
        A(root, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'linear' })
        red.style.clipPath = 'none'
        w3.style.opacity = '1'
        timers.push(
            window.setTimeout(async () => {
                hooks.swap()
                await wait(120)
                if (finished) return
                const out = A(root, [{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: 'linear' })
                await Promise.race([out.finished.catch(() => undefined), wait(700)])
                red.style.clipPath = ''
                w3.style.opacity = ''
                finish()
            }, 600),
        )
        return done
    }

    // 0–0.7s màn đỏ lan ra từ tâm thẻ vừa bấm
    A(
        red,
        [{ clipPath: `circle(0px at ${origin.x}px ${origin.y}px)` }, { clipPath: `circle(${R}px at ${origin.x}px ${origin.y}px)` }],
        { duration: 700, easing: E.inOut },
    )
    // 0.35–1.5s hai elip trắng vẽ dần, xoay từ −60° về −24°
    A(r1, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 1150, delay: 350 })
    A(r2, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 980, delay: 520 })
    A(
        rings,
        [
            { transform: 'translate(-50%,-50%) rotate(-60deg) scale(.7)' },
            { transform: 'translate(-50%,-50%) rotate(-24deg) scale(1)' },
        ],
        { duration: 1150, delay: 350 },
    )
    // 0.8–1.6s đĩa trắng chứa logo
    A(
        badge,
        [
            { transform: 'translate(-50%,-50%) scale(0)' },
            { transform: 'translate(-50%,-50%) scale(1.06)', offset: 0.7 },
            { transform: 'translate(-50%,-50%) scale(1)' },
        ],
        { duration: 800, delay: 800 },
    )
    // 1.5–2.4s vệt sáng quét qua đĩa + lóe trên ngôi sao
    A(shine, [{ transform: 'translateX(-120%)' }, { transform: 'translateX(120%)' }], { duration: 900, delay: 1500, easing: 'ease-in-out' })
    A(
        glint,
        [
            { opacity: 0, transform: 'translate(-50%,-50%) scale(.2) rotate(0)' },
            { opacity: 1, transform: 'translate(-50%,-50%) scale(1.3) rotate(45deg)', offset: 0.5 },
            { opacity: 0, transform: 'translate(-50%,-50%) scale(.4) rotate(90deg)' },
        ],
        { duration: 700, delay: 1700, easing: 'ease-out' },
    )
    // 1.5–2.7s chữ hiện lần lượt; elip mờ xuống 35%
    A(rings, [{ opacity: 1 }, { opacity: 0.35 }], { duration: 600, delay: 1400 })
    A(w1, [{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], { duration: 600, delay: 1500 })
    A(w2, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 0.82, transform: 'none' }], { duration: 600, delay: 1700 })
    A(w3, [{ opacity: 0, letterSpacing: '.4em' }, { opacity: 1, letterSpacing: '.16em' }], { duration: 700, delay: 2000 })
    A(skip, [{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 900 })
    // Thanh vàng ở đáy chạy suốt 3s làm thanh tiến trình
    A(bar, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 3000, easing: 'linear' })
    timers.push(window.setTimeout(() => void exit(), 3000))
    return done
}
