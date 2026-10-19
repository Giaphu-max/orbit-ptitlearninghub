// Chuyển sáng/tối bằng màn phủ PTIT (theo docs/ptit-theme-switch.html), không dùng View Transitions:
// lớp phủ fixed mount sẵn, chỉ animate clip-path / mask / transform / opacity bằng Web Animations API.
// Giao diện chỉ đổi khi màn đã che kín.

export interface CurtainRefs {
    curtain: HTMLElement
    emblem: HTMLElement
    ring: SVGElement
    sat: SVGElement
    marks: SVGElement[]
    stars: HTMLElement
}

export interface SwitchHooks {
    /** Đổi giao diện (gọi khi màn đã che kín). */
    swap: () => void
    /** Bật/tắt chế độ đóng băng cảnh 3D. */
    freeze: (on: boolean) => void
}

const E = {
    inOut: 'cubic-bezier(.65,0,.35,1)',
    out: 'cubic-bezier(.16,1,.3,1)',
    in: 'cubic-bezier(.7,0,.84,0)',
    back: 'cubic-bezier(.34,1.56,.64,1)',
}

let refs: CurtainRefs | null = null
export const bindCurtain = (r: CurtainRefs | null) => {
    refs = r
}
export const curtainReady = () => refs !== null

const wait = (ms: number) => new Promise<void>((res) => setTimeout(res, ms))
const frames = (n: number) =>
    new Promise<void>((res) => {
        const step = (k: number) => (k <= 0 ? res() : requestAnimationFrame(() => step(k - 1)))
        step(n)
        setTimeout(res, 200) // tab nền không có rAF
    })
// Chờ animation xong, nhưng không bao giờ treo: tab nền không có khung hình thì hết hạn vẫn đi tiếp
const settled = (a: Animation) => {
    const t = a.effect?.getComputedTiming()
    const limit = Number(t?.endTime ?? 600) + 400
    return Promise.race([a.finished.then(() => undefined).catch(() => undefined), wait(limit)])
}

export async function playCurtain(origin: { x: number; y: number }, toDark: boolean, hooks: SwitchHooks) {
    const r = refs
    if (!r) {
        hooks.swap()
        return
    }
    const { curtain, emblem, ring, sat, marks, stars } = r
    const running: Animation[] = []
    const anim = (el: Element, kf: Keyframe[], o: KeyframeAnimationOptions) => {
        const a = el.animate(kf, { fill: 'both', ...o })
        running.push(a)
        return a
    }

    const W = window.innerWidth
    const H = window.innerHeight
    const R = Math.hypot(Math.max(origin.x, W - origin.x), Math.max(origin.y, H - origin.y)) + 20
    const Rc = Math.hypot(W / 2, H / 2) + 20
    const maskOk = typeof CSS !== 'undefined' && 'registerProperty' in CSS

    try {
        curtain.classList.toggle('to-dark', toDark)
        curtain.classList.remove('hole')
        curtain.style.setProperty('--hole', '0px')
        curtain.classList.add('on')
        emblem.style.opacity = '0'

        // 1. Màn lớn ra từ chính nút bấm
        const cover = anim(
            curtain,
            [{ clipPath: `circle(0px at ${origin.x}px ${origin.y}px)` }, { clipPath: `circle(${R}px at ${origin.x}px ${origin.y}px)` }],
            { duration: 520, easing: E.inOut },
        )

        // 2. Logo: vòng vẽ ra, vệ tinh chạy quỹ đạo, chữ trồi lên
        anim(
            emblem,
            [
                { opacity: 0, transform: 'translate(-50%,-50%) scale(.82)' },
                { opacity: 1, transform: 'translate(-50%,-50%) scale(1)' },
            ],
            { duration: 520, delay: 200, easing: E.out },
        )
        anim(ring, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 620, delay: 240, easing: E.out })
        anim(
            sat,
            [
                { transform: 'rotate(-200deg) scale(.4)', opacity: 0 },
                { transform: 'rotate(-40deg) scale(1)', opacity: 1, offset: 0.35 },
                { transform: 'rotate(160deg) scale(1)', opacity: 1 },
            ],
            { duration: 900, delay: 220, easing: E.inOut },
        )
        marks.forEach((m, i) =>
            anim(m, [{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'translateY(0)' }], {
                duration: 420,
                delay: 330 + i * 55,
                easing: E.back,
            }),
        )
        Array.from(stars.children).forEach((s, i) =>
            anim(
                s,
                [
                    { opacity: 0, transform: 'scale(0)' },
                    { opacity: 0.9, transform: 'scale(1)', offset: 0.5 },
                    { opacity: 0, transform: 'scale(.4)' },
                ],
                { duration: 900, delay: 260 + (i % 9) * 40, easing: 'ease-out' },
            ),
        )

        // 3. Màn che kín: dừng vẽ 3D, đổi giao diện phía sau
        await settled(cover)
        hooks.freeze(true)
        hooks.swap()
        await frames(3) // chờ React commit + cảnh 3D đặt thẳng ánh sáng mới và vẽ một khung

        // 4. Giữ logo, rồi mở màn từ tâm logo; mở xong mới chạy lại 3D
        await wait(300)
        hooks.freeze(false)
        curtain.classList.add('hole')
        const open = anim(curtain, [{ '--hole': '0px' }, { '--hole': `${Rc}px` }], { duration: 560, easing: E.in })
        anim(
            emblem,
            [
                { opacity: 1, transform: 'translate(-50%,-50%) scale(1)' },
                { opacity: 0, transform: 'translate(-50%,-50%) scale(1.7)' },
            ],
            { duration: 460, easing: E.in },
        )
        // Trình duyệt không animate được thuộc tính tùy biến: mờ màn thay cho mở vòng
        if (!maskOk) anim(curtain, [{ opacity: 1 }, { opacity: 0 }], { duration: 420, easing: 'ease-out' })
        await settled(open)
    } finally {
        hooks.freeze(false)
        curtain.classList.remove('on', 'hole')
        running.forEach((a) => a.cancel())
        curtain.style.removeProperty('--hole')
        emblem.style.opacity = ''
    }
}
