// Intro sau khi chọn / đổi vai trò (theo docs/mockup/ptit-login/ptit-role-select.html).
// Học viện ở trên, lời chào là chữ to nhất, nền đỏ có lưới chấm + cột ký tự rơi + vầng elip. Thoát ở 4,5s (đổi vai + chuyển trang
// phía sau màn, ô logo bay vào ô logo ở header, màn đỏ mở bằng lỗ tròn). Bấm / Enter / Esc nhảy thẳng tới bước thoát.
// Chỉ animate transform / opacity / clip-path / mask bằng Web Animations API; canvas có vòng rAF riêng và dừng khi intro đóng.

export interface IntroInfo {
    /** Các từ của lời chào; từ cuối (nm) tô vàng và dính dấu phẩy */
    words: { text: string; name?: boolean }[]
    /** Dòng cá nhân hóa: chip + câu có phần nhấn */
    chip: string
    pre: string
    strong: string
    post: string
    loadText: string
}

const E = {
    out: 'cubic-bezier(.22,1,.36,1)',
    inOut: 'cubic-bezier(.65,0,.35,1)',
    hole: 'cubic-bezier(.55,0,.75,.2)',
    in: 'cubic-bezier(.55,0,.75,.2)',
    pop: 'cubic-bezier(.3,1.4,.5,1)',
}

let root: HTMLElement | null = null
let active = false
let abort: (() => void) | null = null

export const bindIntro = (r: HTMLElement | null) => {
    if (!r) abort?.()
    root = r
}
export const introReady = () => root !== null
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

const CH = '01<>/\\{}[]#=+*?:;ACGTXZ%&'.split('')
const MONO = '600 12px "JetBrains Mono Variable", "JetBrains Mono", monospace'

/** Lưới chấm navy 10% (vẽ một lần ra canvas phụ) + cột ký tự mono rơi chậm ở nửa phải; trả hàm dừng. */
function startField(c: HTMLCanvasElement) {
    const g = c.getContext('2d')
    if (!g) return () => undefined
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const W = window.innerWidth
    const H = window.innerHeight
    c.width = Math.round(W * dpr)
    c.height = Math.round(H * dpr)
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    const dots = document.createElement('canvas')
    dots.width = c.width
    dots.height = c.height
    const d = dots.getContext('2d')
    if (d) {
        d.setTransform(dpr, 0, 0, dpr, 0, 0)
        d.fillStyle = 'rgba(10,26,80,.10)'
        for (let y = 10; y < H; y += 18) for (let x = 10; x < W; x += 18) d.fillRect(x, y, 1.3, 1.3)
    }
    const cols: { x: number; y: number; v: number; len: number; a: number; ch: string[] }[] = []
    for (let x = W * 0.55; x < W; x += 14) {
        if (Math.random() < 0.5) continue
        cols.push({ x, y: Math.random() * H, v: 30 + Math.random() * 70, len: (6 + Math.random() * 16) | 0, a: 0.12 + Math.random() * 0.22, ch: Array.from({ length: 24 }, () => CH[(Math.random() * CH.length) | 0]) })
    }
    let raf = 0
    let last = performance.now()
    const frame = (now: number) => {
        const dt = Math.min(0.05, (now - last) / 1000)
        last = now
        g.clearRect(0, 0, W, H)
        if (d) g.drawImage(dots, 0, 0, W, H)
        g.font = MONO
        g.textAlign = 'center'
        for (const col of cols) {
            col.y += col.v * dt
            if (col.y - col.len * 14 > H) col.y = -20
            if (Math.random() < 0.04) col.ch[(Math.random() * col.len) | 0] = CH[(Math.random() * CH.length) | 0]
            for (let i = 0; i < col.len; i++) {
                g.fillStyle = `rgba(10,26,80,${col.a * 0.6 * (i === 0 ? 2.2 : 1 - i / col.len)})`
                g.fillText(col.ch[i], col.x, col.y - i * 14)
            }
        }
        raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
}

/** Dựng lời chào từng ký tự và dòng cá nhân hóa bằng DOM API (tên người dùng không đi qua innerHTML). */
function setGreeting(q: (k: string) => HTMLElement, info: IntroInfo) {
    const w3 = q('w3')
    w3.replaceChildren()
    info.words.forEach((w, i) => {
        if (i) w3.append(' ')
        const wd = document.createElement('span')
        wd.className = `wd${w.name ? ' nm' : ''}`
        for (const ch of w.text) {
            const s = document.createElement('span')
            s.className = 'ch'
            s.textContent = ch
            wd.append(s)
        }
        if (i === info.words.length - 1) {
            const comma = document.createElement('span')
            comma.className = 'ch cm'
            comma.style.color = '#0a1a50'
            comma.textContent = ','
            wd.append(comma)
        }
        w3.append(wd)
    })
    const w4 = q('w4')
    w4.replaceChildren()
    const chip = document.createElement('span')
    chip.className = 'chip'
    chip.textContent = info.chip
    const line = document.createElement('span')
    const b = document.createElement('b')
    b.textContent = info.strong
    line.append(info.pre, b, info.post)
    w4.append(chip, line)
    q('loadTx').textContent = info.loadText
    // Mỗi ký tự là một span riêng: chia sẻ một dải gradient liền bằng background-size/position theo vị trí ký tự
    requestAnimationFrame(() => {
        w3.querySelectorAll<HTMLElement>('.nm').forEach((nm) => {
            const cs = [...nm.querySelectorAll<HTMLElement>('.ch:not(.cm)')]
            if (!cs.length) return
            const L = cs[0].offsetLeft
            const last = cs[cs.length - 1]
            const wd = last.offsetLeft + last.offsetWidth - L
            cs.forEach((c) => {
                c.style.backgroundSize = `${wd}px 100%`
                c.style.backgroundPosition = `${L - c.offsetLeft}px 0`
            })
        })
    })
}

export function playRoleIntro(origin: { x: number; y: number }, info: IntroInfo, hooks: IntroHooks): Promise<void> {
    const el = root
    if (!el || active) {
        hooks.swap()
        return Promise.resolve()
    }
    const q = (k: string) => el.querySelector<HTMLElement>(`[data-ri="${k}"]`) as HTMLElement
    const red = q('red')
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const W = window.innerWidth
    const H = window.innerHeight
    const R = Math.hypot(Math.max(origin.x, W - origin.x), Math.max(origin.y, H - origin.y)) + 20
    const maskOk = typeof CSS !== 'undefined' && 'registerProperty' in CSS

    const anims: Animation[] = []
    const timers: number[] = []
    const A = (target: Element, kf: Keyframe[], o: KeyframeAnimationOptions) => {
        const a = target.animate(kf, { fill: 'both', easing: E.out, ...o })
        anims.push(a)
        return a
    }

    let exited = false
    let finished = false
    let stopField: (() => void) | null = null
    let logo: HTMLElement | null = null
    let resolve!: () => void
    const done = new Promise<void>((res) => (resolve = res))

    const finish = () => {
        if (finished) return
        finished = true
        stopField?.()
        timers.forEach(clearTimeout)
        anims.forEach((a) => a.cancel())
        el.removeEventListener('click', onSkip)
        window.removeEventListener('keydown', onKey, true)
        el.classList.remove('on')
        el.setAttribute('aria-hidden', 'true')
        red.classList.remove('hole')
        for (const p of ['--hole', '--hx', '--hy']) red.style.removeProperty(p)
        el.querySelectorAll<HTMLElement>('[style]').forEach((n) => {
            n.style.removeProperty('opacity')
            n.style.removeProperty('transform')
        })
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
        const t = logo?.getBoundingClientRect()
        const cx = t ? t.left + t.width / 2 : 56
        const cy = t ? t.top + t.height / 2 : 40
        const Rc = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) + 20
        if (logo) logo.style.opacity = '0'

        // Ô logo trên cùng bay (FLIP) vào đúng ô logo ở header
        const badge = q('badge')
        const b = badge.getBoundingClientRect()
        const dx = t ? t.left + t.width / 2 - (b.left + b.width / 2) : 0
        const dy = t ? t.top + t.height / 2 - (b.top + b.height / 2) : 0
        const s = t ? t.width / b.width : 0.5
        const fly = A(badge, [{ transform: 'none' }, { transform: `translate(${dx}px,${dy}px) scale(${s})` }], { duration: 650, easing: E.inOut })
        const cur = (n: Element) => Number(getComputedStyle(n).opacity)
        for (const k of ['w1', 'w2', 'w4', 'skip', 'load', 'ghost', 'bg']) {
            const n = el.querySelector(`[data-ri="${k}"]`)
            if (n) A(n, [{ opacity: cur(n) }, { opacity: 0 }], { duration: 260 })
        }
        // Lời chào bay lên rồi mờ đi
        A(q('w3'), [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-30px) scale(1.04)' }], { duration: 420, easing: E.in })
        A(q('rings'), [{ opacity: 0.9 }, { opacity: 0 }], { duration: 500 })

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
        // Chip XP đếm lên khi lỗ tròn vừa mở
        timers.push(window.setTimeout(() => window.dispatchEvent(new Event('orbit:intro-landed')), 700))
        await Promise.race([Promise.all([fly.finished, open.finished]).catch(() => undefined), wait(1600)])
        finish()
    }

    // Bỏ qua: nhảy tới cuối bước vào rồi thoát (vẫn bay vào logo, không cắt ngang)
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
    setGreeting(q, info)
    el.classList.add('on')
    el.setAttribute('aria-hidden', 'false')
    el.addEventListener('click', onSkip)
    window.addEventListener('keydown', onKey, true)

    const chars = [...el.querySelectorAll<HTMLElement>('.ri-w3 .ch')]

    if (reduce) {
        // Giảm chuyển động: hiện tĩnh 1,4s rồi mờ đi
        red.style.clipPath = 'none'
        chars.forEach((c) => ((c.style.opacity = '1'), (c.style.transform = 'none')))
        for (const k of ['top', 'w4', 'load']) q(k).style.opacity = '1'
        A(el, [{ opacity: 0 }, { opacity: 1 }, { opacity: 1 }, { opacity: 0 }], { duration: 1400, easing: 'linear' })
        timers.push(
            window.setTimeout(() => {
                hooks.swap()
            }, 700),
            window.setTimeout(() => {
                red.style.clipPath = ''
                finish()
            }, 1400),
        )
        return done
    }

    stopField = startField(q('bg') as HTMLCanvasElement)
    // Màn đỏ lan ra từ tâm thẻ vừa bấm (650ms)
    A(red, [{ clipPath: `circle(0px at ${origin.x}px ${origin.y}px)` }, { clipPath: `circle(${R}px at ${origin.x}px ${origin.y}px)` }], { duration: 650, easing: E.inOut })
    A(q('bg'), [{ opacity: 0 }, { opacity: 1 }], { duration: 800, delay: 300 })
    // Vầng elip tự vẽ, xoay −60° → −24°, rồi trôi thêm 8° trong 6s
    A(q('rings'), [{ transform: 'translateY(-50%) rotate(-60deg) scale(.8)' }, { transform: 'translateY(-50%) rotate(-24deg) scale(1)' }], { duration: 1600, delay: 250 })
    A(q('rings'), [{ rotate: '0deg' }, { rotate: '8deg' }], { duration: 6000, delay: 1850, easing: 'linear' })
    A(q('r1'), [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 1200, delay: 300 })
    A(q('r2'), [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 1200, delay: 450 })
    A(q('ghost'), [{ opacity: 0, transform: 'translateY(30px) rotate(-8deg)' }, { opacity: 0.13, transform: 'none' }], { duration: 1400, delay: 400 })
    // Học viện rơi xuống đầu tiên (300ms), vệt sáng quét ô logo (900ms), rồi lời chào nảy từng ký tự (450ms + 55ms/chữ), rồi dòng cá nhân (1250ms)
    A(q('top'), [{ opacity: 0, transform: 'translate(-50%,-14px)' }, { opacity: 1, transform: 'translate(-50%,0)' }], { duration: 600, delay: 300 })
    A(q('shine'), [{ transform: 'translateX(-120%)' }, { transform: 'translateX(120%)' }], { duration: 900, delay: 900, easing: 'ease-in-out' })
    chars.forEach((c, i) =>
        A(c, [{ opacity: 0, transform: 'translateY(.5em) rotate(6deg)' }, { opacity: 1, transform: 'none' }], { duration: 620, delay: 450 + i * 55, easing: E.pop }),
    )
    A(q('w4'), [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 600, delay: 1250 })
    A(q('load'), [{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 700 })
    A(q('skip'), [{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 800 })
    A(q('bar'), [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 4500, easing: 'linear' })
    timers.push(window.setTimeout(() => void exit(), 4500))
    return done
}
