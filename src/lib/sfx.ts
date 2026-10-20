import { create } from 'zustand'

// Âm thanh tổng hợp bằng Web Audio API (không dùng file), chép từ docs/mockup/orbit-focus-reward.html:
// compressor + master 0.9, bell, thump, whoosh, tick và bộ SFX correct / fixed / wrong / tick / reward.
// Một AudioContext dùng chung, mở khóa (resume) ở thao tác đầu tiên của người dùng.

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

/** Công tắc "Âm thanh" ở menu avatar: mặc định bật, lưu localStorage (khóa riêng, không bị "Đặt lại dữ liệu demo"). */
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

const soundOn = () => useSoundStore.getState().enabled

let ac: AudioContext | null = null
let master: GainNode | null = null
let unlocked = false

function audio(): AudioContext | null {
    if (!unlocked) return null // trình duyệt chặn âm thanh trước thao tác đầu tiên
    if (!ac) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (!Ctor) return null
        ac = new Ctor()
        const comp = ac.createDynamicsCompressor()
        comp.threshold.value = -14
        comp.knee.value = 8
        comp.ratio.value = 4
        comp.attack.value = 0.003
        comp.release.value = 0.2
        master = ac.createGain()
        master.gain.value = 0.9
        master.connect(comp)
        comp.connect(ac.destination)
    }
    if (ac.state === 'suspended') void ac.resume()
    return ac
}

/** Mở khóa âm thanh ở lần bấm/phím đầu tiên (chỉ phát sau thao tác của người dùng). */
export function armAudio() {
    if (typeof window === 'undefined' || unlocked) return
    const unlock = () => {
        unlocked = true
        audio()
        window.removeEventListener('pointerdown', unlock, true)
        window.removeEventListener('keydown', unlock, true)
    }
    window.addEventListener('pointerdown', unlock, true)
    window.addEventListener('keydown', unlock, true)
}

function tone(c: AudioContext, freq: number, t: number, dur: number, type: OscillatorType, vol: number) {
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, t)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g)
    g.connect(master!)
    o.start(t)
    o.stop(t + dur + 0.05)
}

/** "Ting" kim loại sáng: nốt gốc + các họa âm không nguyên. */
function bell(c: AudioContext, freq: number, t: number, vol: number) {
    tone(c, freq, t, 1.1, 'sine', vol)
    tone(c, freq * 2.76, t, 0.6, 'sine', vol * 0.45)
    tone(c, freq * 5.4, t, 0.3, 'sine', vol * 0.22)
    tone(c, freq * 2, t, 0.25, 'triangle', vol * 0.25)
}

/** Tiếng trầm dưới cú "đập" của số XP. */
function thump(c: AudioContext, t: number) {
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(140, t)
    o.frequency.exponentialRampToValueAtTime(42, t + 0.22)
    g.gain.setValueAtTime(0.9, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3)
    o.connect(g)
    g.connect(master!)
    o.start(t)
    o.stop(t + 0.35)
}

function whoosh(c: AudioContext, t: number, dur: number) {
    const n = c.createBufferSource()
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    n.buffer = buf
    const f = c.createBiquadFilter()
    f.type = 'bandpass'
    f.Q.value = 1.2
    f.frequency.setValueAtTime(400, t)
    f.frequency.exponentialRampToValueAtTime(5000, t + dur)
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.35, t + dur * 0.7)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    n.connect(f)
    f.connect(g)
    g.connect(master!)
    n.start(t)
    n.stop(t + dur)
}

export const SFX = {
    /** Đúng ngay lần đầu; `combo` là số lần đúng liên tiếp (đã tính lần này), mỗi bậc cao hơn một nửa cung, tối đa 6. */
    correct(combo = 1) {
        const c = soundOn() && audio()
        if (!c) return
        const step = Math.min(combo, 6)
        bell(c, 1318.5 * Math.pow(2, step / 12), c.currentTime, 0.55)
    },
    /** Sửa đúng sau khi sai: hai nốt đi lên. */
    fixed() {
        const c = soundOn() && audio()
        if (!c) return
        const t = c.currentTime
        bell(c, 1046.5, t, 0.5)
        bell(c, 1568, t + 0.11, 0.55)
    },
    wrong() {
        const c = soundOn() && audio()
        if (!c) return
        const t = c.currentTime
        tone(c, 220, t, 0.18, 'triangle', 0.25)
        tone(c, 185, t + 0.09, 0.22, 'triangle', 0.22)
    },
    tick() {
        const c = soundOn() && audio()
        if (!c) return
        tone(c, 2400 + Math.random() * 400, c.currentTime, 0.04, 'square', 0.05)
    },
    /**
     * Màn nhận XP: whoosh, thump, chuỗi chuông 4 nốt và đuôi ngân. `ratio` nâng cao độ (lên cấp chơi lần 2 với 4/3, quãng 4);
     * `bare` bỏ whoosh và thump khi chơi lặp.
     */
    reward({ ratio = 1, bare = false }: { ratio?: number; bare?: boolean } = {}) {
        const c = soundOn() && audio()
        if (!c) return
        const t = c.currentTime
        if (!bare) {
            whoosh(c, t, 0.32)
            thump(c, t + 0.3)
        }
        ;[1046.5, 1318.5, 1568, 2093].forEach((f, i) => bell(c, f * ratio, t + 0.32 + i * 0.075, 0.42))
        tone(c, 2093 * ratio, t + 0.62, 1.4, 'sine', 0.12)
        tone(c, 2637 * ratio, t + 0.62, 1.4, 'sine', 0.08)
    },
}

/** Rung nhẹ nếu thiết bị hỗ trợ (điện thoại). */
export function haptic(pattern: number | number[]) {
    try {
        navigator.vibrate?.(pattern)
    } catch {
        // Trình duyệt không cho rung
    }
}
