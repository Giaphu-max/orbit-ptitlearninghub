import { create } from 'zustand'

// Âm thanh tổng hợp bằng Web Audio API (không dùng file) + rung nhẹ trên điện thoại.
// Chỉ phát sau thao tác của người dùng: AudioContext được mở khóa ở lần bấm/phím đầu tiên.

const KEY = 'orbit-sound'

const readEnabled = () => {
    try {
        return localStorage.getItem(KEY) !== 'off'
    } catch {
        return true
    }
}

interface SoundState {
    enabled: boolean
    setEnabled: (on: boolean) => void
}

/** Công tắc "Âm thanh" ở menu avatar; mặc định bật, lưu localStorage (khóa riêng, không bị "Đặt lại dữ liệu demo"). */
export const useSoundStore = create<SoundState>()((set) => ({
    enabled: readEnabled(),
    setEnabled: (on) => {
        try {
            localStorage.setItem(KEY, on ? 'on' : 'off')
        } catch {
            // Không lưu được thì chỉ giữ trong phiên
        }
        set({ enabled: on })
    },
}))

let ctx: AudioContext | null = null
let unlocked = false

const getCtx = () => {
    if (ctx) return ctx
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    try {
        ctx = new Ctor()
    } catch {
        ctx = null
    }
    return ctx
}

/** Mở khóa âm thanh ở thao tác đầu tiên của người dùng (trình duyệt chặn phát trước đó). */
export function armAudio() {
    if (typeof window === 'undefined' || unlocked) return
    const unlock = () => {
        unlocked = true
        void getCtx()?.resume()
        window.removeEventListener('pointerdown', unlock, true)
        window.removeEventListener('keydown', unlock, true)
    }
    window.addEventListener('pointerdown', unlock, true)
    window.addEventListener('keydown', unlock, true)
}

/** Một nốt "ting": sóng sin + họa âm bậc 2 nhẹ, vào nhanh, tắt dần theo hàm mũ. */
function note(freq: number, at: number, dur = 0.28, vol = 0.13) {
    const c = ctx
    if (!c) return
    const t0 = c.currentTime + at
    for (const [mult, v] of [[1, vol], [2, vol * 0.22]] as const) {
        const osc = c.createOscillator()
        const gain = c.createGain()
        osc.type = 'sine'
        osc.frequency.value = freq * mult
        gain.gain.setValueAtTime(0.0001, t0)
        gain.gain.exponentialRampToValueAtTime(v, t0 + 0.008)
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
        osc.connect(gain).connect(c.destination)
        osc.start(t0)
        osc.stop(t0 + dur + 0.02)
    }
}

function play(fn: () => void) {
    if (!useSoundStore.getState().enabled || !unlocked) return
    const c = getCtx()
    if (!c) return
    if (c.state === 'suspended') void c.resume().then(fn)
    else fn()
}

/** Thang ngũ cung đi lên (C5 D5 E5 G5 A5 C6 D6 E6) cho combo. */
const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51]
const G5 = 783.99
const C6 = 1046.5

/** Đúng ngay lần đầu: một "ting" sáng; combo càng cao nốt càng cao. */
export const playCorrect = (combo = 1) => play(() => note(SCALE[Math.min(Math.max(combo, 1), SCALE.length) - 1], 0, 0.3))
/** Sửa đúng sau khi sai: "ting-ting" hai nốt đi lên. */
export const playCorrected = () => play(() => (note(G5, 0, 0.2), note(C6, 0.09, 0.34)))
/** Xong bài / xong test: hai nốt, nốt cuối ngân dài hơn. */
export const playComplete = () => play(() => (note(SCALE[2], 0, 0.22), note(SCALE[5], 0.11, 0.5, 0.15)))
/** Lên cấp / mở huy hiệu: hồi ba nốt C–E–G rồi nốt cao ngân dài. */
export const playFanfare = () => play(() => (note(SCALE[0], 0, 0.25), note(SCALE[2], 0.11, 0.25), note(SCALE[3], 0.22, 0.25), note(SCALE[5], 0.34, 0.7, 0.16)))

/** Rung nhẹ nếu thiết bị hỗ trợ (điện thoại). */
export function haptic(pattern: number | number[]) {
    try {
        navigator.vibrate?.(pattern)
    } catch {
        // Trình duyệt không cho rung
    }
}
