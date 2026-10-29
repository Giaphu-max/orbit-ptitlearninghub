import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertCircle, Camera, Check, ChevronDown, Grid3x3, Images, Info, Loader2, RotateCcw, Sparkles, X } from 'lucide-react'
import type { LightingIntent } from '@/lib/api-types'
import { ApiRequestError, generateEnvironment, isNotLightingError } from '@/lib/api'
import { ENV_LIMITS } from '@/lib/environment'
import { SFX } from '@/lib/sfx'
import { resolveBrief, STUDIO_BRIEFS } from '@/lib/studio-briefs'
import { useStudioHints } from '@/lib/studio-hints'
import { useOrbitStore } from '@/store/useOrbitStore'
import { gradeShot, SHOTS_MAX, useStudioSession, type StudioShot } from '@/store/useStudioSession'
import { applyChange, describeChange } from '@/lib/studio-suggest'
import { elevationLabel } from '@/lib/studio-snapshot'
import { DEFAULT_SETUP, setupFromEnvironment, type CameraSetup } from '@/lib/studio-setup'
import { BriefPicker } from '@/components/studio/brief-picker'
import { GalleryPanel, ScoreBadge } from '@/components/studio/gallery-panel'
import { ShotViewer } from '@/components/studio/shot-viewer'
import { StudioRail, type RailTab } from '@/components/studio/studio-rail'
import type { CaptureFn } from '@/components/studio/studio-scene'

// Phần 3D tải riêng (three.js + R3F nặng).
const StudioScene = lazy(() => import('@/components/studio/studio-scene'))

function canRender3D() {
    try {
        const cv = document.createElement('canvas')
        return Boolean(cv.getContext('webgl2') || cv.getContext('webgl'))
    } catch {
        return false
    }
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

const ENV_COOLDOWN_MS = 1500
const ENV_SUGGESTIONS = ['Hoàng hôn gắt, bóng đổ dài', 'Ánh sáng studio mềm chụp chân dung', 'Đêm có sương, đèn viền lạnh']
const ENV_STEPS = ['Đọc mô tả của bạn', 'Chọn hướng và màu đèn', 'Đặt nền, sương, độ tương phản']

type EnvState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'error' | 'hint'; message: string }

const glass = 'border border-ink-foreground/15 bg-ink/60 text-ink-foreground backdrop-blur-md'

/** /studio – Virtual Director: một màn hình làm việc. Chỉnh máy và đèn, chụp (không gọi API), chọn ảnh trong dải phim để AI chấm. */
export function OrbitStudioView() {
    const [setup, setSetup] = useState<CameraSetup>(DEFAULT_SETUP)
    const [grid, setGrid] = useState(true)
    const [tab, setTab] = useState<RailTab>('brief')
    const captureRef = useRef<CaptureFn | null>(null)
    const viewportRef = useRef<HTMLDivElement>(null)
    const stripRef = useRef<HTMLDivElement>(null)
    const flashRef = useRef<HTMLDivElement>(null)
    const briefBest = useOrbitStore((s) => s.briefBest)
    const [webgl] = useState(canRender3D)
    const [envPrompt, setEnvPrompt] = useState('')
    const [searchParams, setSearchParams] = useSearchParams()
    const brief = resolveBrief(searchParams)
    const [pickerOpen, setPickerOpen] = useState(false)
    const hints = useStudioHints(setup)
    const [env, setEnv] = useState<EnvState>({ kind: 'idle' })
    const [envStep, setEnvStep] = useState(0)
    // Ý đồ ánh sáng đã áp dụng (giữ lại khi lần sau bị từ chối hoặc lỗi)
    const [applied, setApplied] = useState<{ prompt: string; explanation: string; setup: CameraSetup } | null>(null)
    const envBusy = useRef(false)
    const lastEnvAt = useRef(0)
    const lastPrompt = useRef('')
    const reduced = useReducedMotion()
    // Thanh "AI dựng sáng" thu gọn mặc định; nội dung gõ dở (envPrompt) giữ nguyên khi thu lại
    const [aiOpen, setAiOpen] = useState(false)
    const aiOpenRef = useRef(false)
    aiOpenRef.current = aiOpen
    const aiRef = useRef<HTMLDivElement>(null)
    const aiInputRef = useRef<HTMLInputElement>(null)

    const { shots, selectedId, drawerOpen, galleryOpen } = useStudioSession()
    const selected = shots.find((s) => s.id === selectedId)
    const selectedIndex = shots.findIndex((s) => s.id === selectedId)
    const [toast, setToast] = useState<{ message: string; undo?: () => void } | null>(null)
    const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
    const tweenRaf = useRef(0)
    const loading = env.kind === 'loading'
    // Đang xem ảnh: popup nổi trên studio, studio 3D luôn mounted phía sau
    const viewing = drawerOpen && Boolean(selected)
    const shotBriefIndex = Math.max(0, STUDIO_BRIEFS.findIndex((b) => b.id === selected?.briefId))

    const onReady = useCallback((fn: CaptureFn) => {
        captureRef.current = fn
    }, [])

    // Esc đóng lớp trên cùng trước: bảng lưới → popup xem ảnh
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return
            // Thanh AI đang mở: Esc chỉ thu thanh này, không đóng lớp khác
            if (aiOpenRef.current) {
                setAiOpen(false)
                return
            }
            const st = useStudioSession.getState()
            if (st.galleryOpen) st.setGallery(false)
            else if (st.drawerOpen) st.openDrawer(false)
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [])

    // Thanh AI: focus vào ô nhập khi mở; bấm ra ngoài cụm thì thu lại
    useEffect(() => {
        if (!aiOpen) return
        aiInputRef.current?.focus()
        const onDown = (e: PointerEvent) => {
            const t = e.target as Node
            if (aiRef.current?.contains(t)) return
            if ((t as HTMLElement).closest?.('[data-ai-toggle]')) return
            setAiOpen(false)
        }
        document.addEventListener('pointerdown', onDown)
        return () => document.removeEventListener('pointerdown', onDown)
    }, [aiOpen])

    // Vào trang hoặc đổi đề: mở sẵn tab Đề bài
    useEffect(() => {
        setTab('brief')
    }, [brief.id])

    useEffect(() => () => {
        clearTimeout(toastTimer.current)
        cancelAnimationFrame(tweenRaf.current)
    }, [])

    const showToast = (message: string, undo?: () => void, ms = 5000) => {
        clearTimeout(toastTimer.current)
        setToast({ message, undo })
        toastTimer.current = setTimeout(() => setToast(null), ms)
    }

    // Dải phim cuộn ngang: ảnh mới tự cuộn tới cuối
    useEffect(() => {
        const el = stripRef.current
        if (el) el.scrollLeft = el.scrollWidth
    }, [shots.length])

    // Ba bước "AI đang dựng ánh sáng" tick dần theo thời gian trong lúc chờ API
    useEffect(() => {
        if (!loading) return
        const timers = [setTimeout(() => setEnvStep(1), 900), setTimeout(() => setEnvStep(2), 1800)]
        return () => timers.forEach(clearTimeout)
    }, [loading])

    const flyToStrip = (id: number, image: string) => {
        const vp = viewportRef.current
        if (!vp || reducedMotion()) return
        requestAnimationFrame(() => {
            const cell = stripRef.current?.querySelector<HTMLElement>(`[data-shot-id="${id}"]`)
            if (!cell) return
            const from = vp.getBoundingClientRect()
            const to = cell.getBoundingClientRect()
            const img = document.createElement('img')
            img.src = image
            img.alt = ''
            img.setAttribute('aria-hidden', 'true')
            Object.assign(img.style, {
                position: 'fixed', left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`,
                objectFit: 'cover', borderRadius: '20px', zIndex: '60', pointerEvents: 'none', transformOrigin: 'top left',
            })
            document.body.appendChild(img)
            cell.style.opacity = '0'
            const done = () => {
                img.remove()
                cell.style.opacity = ''
            }
            const anim = img.animate(
                [
                    { transform: 'none', opacity: 1 },
                    { transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${to.width / from.width}, ${to.height / from.height})`, opacity: 1 },
                ],
                { duration: 520, delay: 180, easing: 'cubic-bezier(.5,0,.2,1)', fill: 'both' },
            )
            anim.onfinish = done
            anim.oncancel = done
        })
    }

    /** Chụp ngay, không gọi API: chớp trắng, ảnh bay vào dải phim, tiếng màn trập. */
    const shoot = () => {
        const capture = captureRef.current
        if (!capture) return
        if (useStudioSession.getState().shots.length >= SHOTS_MAX) {
            showToast(`Đã đủ ${SHOTS_MAX} ảnh, xóa bớt để chụp tiếp`, undefined, 4000)
            return
        }
        const { dataUrl, base64 } = capture()
        const intent = buildIntent(setup, applied)
        const id = useStudioSession.getState().addShot({ image: dataUrl, base64, setup, intent, briefId: brief.id })
        if (id === null) return
        SFX.shutter()
        if (!reducedMotion()) {
            flashRef.current?.animate([{ opacity: 0.9 }, { opacity: 0 }], { duration: 280, easing: 'ease-out' })
            viewportRef.current?.animate([{ transform: 'scale(.99)' }, { transform: 'none' }], { duration: 220 })
        }
        flyToStrip(id, dataUrl)
    }

    const applyEnvironment = async (text: string, retry = false) => {
        const prompt = text.trim()
        // Khóa bằng ref (state cập nhật chậm một nhịp) và chờ một chút giữa hai lần bấm để không đốt hạn mức
        if (!prompt || envBusy.current || (!retry && Date.now() - lastEnvAt.current < ENV_COOLDOWN_MS)) return
        envBusy.current = true
        lastEnvAt.current = Date.now()
        lastPrompt.current = prompt
        setEnvStep(0)
        setEnv({ kind: 'loading' })
        try {
            const spec = await generateEnvironment({ prompt })
            // Chỉ đổi cảnh khi đã có thông số hợp lệ; lỗi thì cảnh cũ được giữ nguyên
            const next = setupFromEnvironment(setup, spec)
            setSetup(next)
            setApplied({ prompt, explanation: spec.explanation, setup: next })
            setEnv({ kind: 'idle' })
            // Cảnh tự nội suy đèn (~600ms); thêm một nhịp sáng để mắt thấy "AI vừa bật đèn"
            if (!reducedMotion()) {
                viewportRef.current?.animate([{ filter: 'brightness(1.6) saturate(1.3)' }, { filter: 'none' }], { duration: 700, easing: 'ease-out' })
            }
        } catch (err) {
            if (isNotLightingError(err)) {
                setEnv({ kind: 'hint', message: err.message })
            } else {
                setEnv({ kind: 'error', message: err instanceof ApiRequestError ? err.message : 'AI chưa tạo được ánh sáng lúc này, cảnh được giữ nguyên. Bạn thử lại nhé.' })
            }
        } finally {
            envBusy.current = false
            lastEnvAt.current = Date.now()
        }
    }

    const askLighting = (text: string) => {
        setAiOpen(false)
        setEnvPrompt(text)
        void applyEnvironment(text)
    }

    /** Đưa cảnh về thiết lập của một ảnh: số (máy, đèn) nội suy ~500ms; màu và nền do cảnh tự nội suy. */
    const reuseSetup = (shot: StudioShot) => {
        const from = setup
        const to = shot.setup
        cancelAnimationFrame(tweenRaf.current)
        // Môi trường AI đi kèm ảnh (nếu có) để các lần chấm sau vẫn đúng ý đồ
        setApplied(shot.intent.prompt ? { prompt: shot.intent.prompt, explanation: shot.intent.explanation ?? '', setup: to } : null)
        useStudioSession.getState().openDrawer(false)
        if (reducedMotion()) {
            setSetup(to)
            return
        }
        const keys = ['focalLengthMm', 'azimuthDeg', 'elevationDeg', 'distance', 'shiftX', 'shiftY', 'key', 'keyAngleDeg', 'fill', 'rim'] as const
        const t0 = performance.now()
        const step = (now: number) => {
            const t = Math.min(1, (now - t0) / 500)
            const k = 1 - Math.pow(1 - t, 3)
            if (t >= 1) {
                setSetup(to)
                return
            }
            const next: CameraSetup = { ...to }
            for (const key of keys) next[key] = from[key] + (to[key] - from[key]) * k
            setSetup(next)
            tweenRaf.current = requestAnimationFrame(step)
        }
        tweenRaf.current = requestAnimationFrame(step)
    }

    const deleteShot = (shot: StudioShot) => {
        const index = useStudioSession.getState().removeShot(shot.id)
        if (index < 0) return
        showToast('Đã xóa ảnh', () => {
            const ok = useStudioSession.getState().restoreShot(shot, index)
            if (ok) useStudioSession.getState().select(shot.id)
            showToast(ok ? 'Đã hoàn tác' : `Đã đủ ${SHOTS_MAX} ảnh, chưa hoàn tác được`, undefined, 2500)
        })
    }

    const gradeLabel = !selected ? 'Chấm ảnh này' : selected.status === 'done' ? 'Đã chấm' : selected.status === 'grading' ? 'Đang chấm…' : 'Chấm ảnh này'
    const gradeDisabled = !selected || selected.status === 'done' || selected.status === 'grading'

    const briefIndex = STUDIO_BRIEFS.findIndex((b) => b.id === brief.id)

    /** Chọn đề khác: đưa cảnh về mặc định; hỏi trước nếu còn ảnh chụp chưa chấm. */
    const pickBrief = (id: string) => {
        setPickerOpen(false)
        if (id === brief.id) return
        const unsaved = useStudioSession.getState().shots.some((s) => s.status === 'idle' || s.status === 'error')
        if (unsaved && !window.confirm('Bạn còn ảnh chụp chưa chấm. Đổi đề sẽ đặt lại cảnh về mặc định (ảnh đã chụp vẫn được giữ). Đổi đề chứ?')) return
        cancelAnimationFrame(tweenRaf.current)
        setSetup(DEFAULT_SETUP)
        setApplied(null)
        setEnvPrompt('')
        setEnv({ kind: 'idle' })
        setSearchParams({ brief: id }, { replace: true })
    }

    const tabForSteps = tab === 'brief' ? 'light' : tab
    const hasShots = shots.length > 0
    const hasGraded = shots.some((s) => s.status === 'done')
    const isGrading = shots.some((s) => s.status === 'grading')

    const getStepStatus = (index: number) => {
        const tab = tabForSteps
        if (isGrading) {
            if (index === 0) return { on: false, done: true }
            if (index === 1) return { on: false, done: true }
            return { on: true, done: false }
        }
        if (hasGraded) {
            if (tab === 'light') return { on: index === 0, done: index > 0 }
            if (tab === 'camera') return { on: index === 1, done: index !== 1 }
            return { on: false, done: true }
        }
        if (hasShots) {
            if (tab === 'light') return { on: index === 0, done: false }
            if (tab === 'camera') return { on: index === 1, done: index === 0 }
            return { on: index === 2, done: index < 2 }
        }
        if (tab === 'camera') {
            return { on: index === 1, done: index === 0 }
        }
        return { on: index === 0, done: false }
    }

    const STUDIO_STEPS = [
        {
            id: 'lighting',
            label: 'Dựng sáng',
            onClick: () => setTab('light'),
        },
        {
            id: 'camera',
            label: 'Chụp ảnh',
            onClick: () => setTab('camera'),
        },
        {
            id: 'grading',
            label: 'AI chấm',
            onClick: () => {
                if (shots.length === 0) {
                    showToast('Chụp ít nhất 1 ảnh trước khi yêu cầu AI chấm', undefined, 3000)
                } else if (selected && selected.status !== 'done' && selected.status !== 'grading') {
                    void gradeShot(selected.id)
                } else if (selected) {
                    useStudioSession.getState().openDrawer(true)
                }
            },
        },
    ]

    return (
        <div className="w-full overflow-x-clip">
            <div className="container-wide py-4 lg:py-6">
                {/* Hàng đầu trang không khung: Cột 8 (đề bài + chip tiêu chí) | Cột 4 (stepper 3 bước) */}
                <header className="lesson-grid items-end mb-6">
                    {/* Cột 8: eyebrow + chip chọn đề, tiêu đề ngắn, một dòng ý đồ */}
                    <div className="min-w-0">
                        <button
                            type="button"
                            aria-haspopup="dialog"
                            aria-expanded={pickerOpen}
                            onClick={() => setPickerOpen(true)}
                            className="inline-flex items-center gap-2 rounded-lg py-1 pr-2.5 text-[13px] font-bold text-muted-foreground transition hover:text-strong"
                        >
                            <span>Studio 3D · Nhiếp ảnh & Ánh sáng</span>
                            <em className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-[3px] font-mono text-[11.5px] font-bold not-italic text-brand-ink">
                                Đề {briefIndex + 1}/{STUDIO_BRIEFS.length}
                                <ChevronDown size={11} aria-hidden />
                            </em>
                        </button>
                        <h1 title={brief.shortTitle} className="mt-1 truncate text-2xl font-black leading-tight tracking-tight text-strong">
                            {brief.shortTitle}
                        </h1>
                    </div>

                    {/* Cột 4: stepper 3 bước rút gọn "Dựng sáng → Chụp ảnh → AI chấm" */}
                    <div className="w-full">
                        <nav aria-label="Các bước thực hành" className="flex w-full items-center justify-between gap-1.5">
                            {STUDIO_STEPS.map((st, i) => {
                                const { on, done } = getStepStatus(i)
                                return (
                                    <span key={st.id} className="contents">
                                        {i > 0 && (
                                            <span aria-hidden className="flex-none text-muted-foreground/50">
                                                →
                                            </span>
                                        )}
                                        <button
                                            type="button"
                                            onClick={st.onClick}
                                            aria-current={on ? 'step' : undefined}
                                            className={`flex flex-1 items-center justify-center gap-[7px] whitespace-nowrap rounded-full border px-2 py-[7px] text-[13px] font-bold transition duration-fast ${
                                                on
                                                    ? 'border-brand-600 bg-brand-600 text-ink-foreground shadow-sm'
                                                    : done
                                                      ? 'border-border bg-card text-success shadow-sm hover:text-success'
                                                      : 'border-border bg-card text-muted-foreground hover:text-strong'
                                            }`}
                                        >
                                            <em
                                                className={`flex h-[18px] w-[18px] items-center justify-center rounded-full font-mono text-[10.5px] font-bold not-italic ${
                                                    on ? 'bg-ink-foreground/25' : done ? 'bg-success/15' : 'bg-muted'
                                                }`}
                                            >
                                                {done ? <Check size={11} strokeWidth={3} aria-label="đã xong" /> : i + 1}
                                            </em>
                                            {st.label}
                                        </button>
                                    </span>
                                )
                            })}
                        </nav>
                    </div>
                </header>

                {/* Khung 3D (Cột 8) + Bảng điều khiển (Cột 4), cùng lưới với hàng header */}
                <div className="lesson-grid lesson-theater">
                    <section className="lesson-player-area min-w-0" aria-label="Khung làm việc studio">
                        {/* Canvas 3D: 16:9 như player bài học */}
                        <div ref={viewportRef} style={{ viewTransitionName: 'vt-studio-stage' }} className="relative isolate aspect-video w-full overflow-hidden rounded-[20px] bg-ink shadow-raised">
                        {webgl ? (
                            <div className="absolute inset-0">
                                <Suspense fallback={<div className="flex h-full items-center justify-center text-ink-foreground"><Loader2 className="animate-spin" /></div>}>
                                    <StudioScene setup={setup} onReady={onReady} />
                                </Suspense>
                            </div>
                        ) : (
                            <p className="flex h-full items-center justify-center px-6 text-center text-sm text-ink-foreground">
                                Thiết bị này chưa chạy được 3D (không có WebGL). Bạn thử trình duyệt khác nhé.
                            </p>
                        )}
                        {grid && (
                            <div aria-hidden className="pointer-events-none absolute inset-0">
                                <div className="absolute inset-y-0 left-1/3 w-px bg-ink-foreground/50" />
                                <div className="absolute inset-y-0 left-2/3 w-px bg-ink-foreground/50" />
                                <div className="absolute inset-x-0 top-1/3 h-px bg-ink-foreground/50" />
                                <div className="absolute inset-x-0 top-2/3 h-px bg-ink-foreground/50" />
                            </div>
                        )}

                        <div className="absolute inset-x-3 top-3 flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${glass}`}>
                                <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-brand-500" />
                                Trực tiếp
                            </span>
                            <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${glass}`}>
                                <span className="font-mono">{setup.focalLengthMm}mm</span> · {elevationLabel(setup.elevationDeg)}
                            </span>
                            <span className="flex-1" />
                            <button
                                type="button"
                                aria-pressed={grid}
                                onClick={() => setGrid((g) => !g)}
                                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 ${grid ? 'border border-brand-light/60 bg-ink/70 text-ink-foreground backdrop-blur-md' : glass}`}
                            >
                                <Grid3x3 size={13} /> Lưới 1/3
                            </button>
                            <button
                                type="button"
                                onClick={() => setSetup(DEFAULT_SETUP)}
                                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 ${glass}`}
                            >
                                <RotateCcw size={13} /> Đặt lại
                            </button>
                        </div>

                        {/* Thanh AI Prompt-to-Environment: thu gọn thành một nút, bấm để mở cụm gợi ý + ô nhập */}
                        {!aiOpen && (
                            <button
                                type="button"
                                data-ai-toggle
                                aria-expanded={false}
                                disabled={loading}
                                onClick={() => setAiOpen(true)}
                                className={`absolute bottom-4 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition hover:bg-ink/80 disabled:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 ${glass}`}
                            >
                                <Sparkles size={13} /> AI dựng sáng
                            </button>
                        )}
                        {aiOpen && (
                            <motion.div
                                ref={aiRef}
                                initial={reduced ? false : { opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: reduced ? 0 : 0.2, ease: 'easeOut' }}
                                className={`absolute inset-x-3 bottom-4 mx-auto flex max-w-[680px] flex-col gap-2 transition-opacity duration-base ${loading ? 'pointer-events-none opacity-55' : ''}`}
                                aria-busy={loading}
                            >
                                <ul className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] sm:flex-wrap sm:justify-center sm:overflow-visible" aria-label="Gợi ý ánh sáng nhanh">
                                    {ENV_SUGGESTIONS.map((t) => (
                                        <li key={t} className="shrink-0">
                                            <button
                                                type="button"
                                                disabled={loading}
                                                onClick={() => askLighting(t)}
                                                className={`rounded-full px-3 py-1.5 text-xs font-bold transition hover:bg-ink/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 ${glass}`}
                                            >
                                                {t}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                                <form
                                    className={`flex items-center gap-2 rounded-2xl p-2 ${glass}`}
                                    onSubmit={(e) => {
                                        e.preventDefault()
                                        setAiOpen(false)
                                        void applyEnvironment(envPrompt)
                                    }}
                                >
                                    <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-ink-foreground">
                                        <Sparkles size={16} />
                                    </span>
                                    <input
                                        ref={aiInputRef}
                                        value={envPrompt}
                                        onChange={(e) => setEnvPrompt(e.target.value)}
                                        maxLength={ENV_LIMITS.promptMaxChars}
                                        disabled={loading}
                                        aria-label="Mô tả ánh sáng"
                                        placeholder="Mô tả ánh sáng bạn muốn, AI sẽ đặt đèn…"
                                        className="min-w-0 flex-1 bg-transparent px-1 py-2 text-[15px] text-ink-foreground placeholder:text-ink-foreground/60 focus-visible:outline-none"
                                    />
                                    <button
                                        type="submit"
                                        disabled={loading || !envPrompt.trim()}
                                        className="shrink-0 rounded-xl bg-ink-foreground px-4 py-2.5 text-sm font-extrabold text-brand-800 transition hover:opacity-90 disabled:opacity-50"
                                    >
                                        Tạo
                                    </button>
                                </form>
                            </motion.div>
                        )}

                        {galleryOpen && <GalleryPanel />}
                        <EnvOverlay env={env} step={envStep} onRetry={() => void applyEnvironment(lastPrompt.current, true)} onClose={() => setEnv({ kind: 'idle' })} />
                        <div ref={flashRef} aria-hidden className="pointer-events-none absolute inset-0 bg-ink-foreground opacity-0" />
                    </div>

                </section>

                {/* Bảng bên cao đúng bằng khung 3D (contain: size, như trang học bài) */}
                <div className="lesson-side">
                    <StudioRail
                        tab={tab}
                        onTab={setTab}
                        setup={setup}
                        onSetup={setSetup}
                        brief={brief}
                        hints={hints}
                        envLoading={loading}
                        onApplyLighting={askLighting}
                        explanation={applied?.explanation ?? null}
                    />
                </div>
                </div>

                {/* Hàng chụp ảnh: mỏng, không khung, nằm trong cột 8 */}
                <div className="lesson-grid mt-4">
                    <div className="flex h-14 min-w-0 items-center gap-3">
                        <button
                            type="button"
                            onClick={shoot}
                            disabled={!webgl}
                            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-extrabold text-ink-foreground shadow-brand transition hover:bg-brand-700 active:scale-[0.98] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                        >
                            <Camera size={16} /> Chụp ảnh
                        </button>
                        <p className="shrink-0 font-mono text-xs text-muted-foreground" aria-live="polite">{shots.length} ảnh</p>
                        <div ref={stripRef} aria-label={`Ảnh đã chụp, ${shots.length} ảnh`} className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto p-0.5 [scrollbar-width:thin]">
                            {shots.length === 0 && <span className="text-sm text-muted-foreground">Chưa có ảnh nào</span>}
                            {shots.map((shot, i) => {
                                const sel = shot.id === selectedId
                                return (
                                    <button
                                        key={shot.id}
                                        type="button"
                                        data-shot-id={shot.id}
                                        aria-pressed={sel}
                                        aria-label={`Ảnh ${i + 1}${shot.status === 'done' ? `, ${shot.result?.overall} điểm` : shot.status === 'grading' ? ', đang chấm' : ', chưa chấm'}`}
                                        onClick={() => useStudioSession.getState().openShot(shot.id)}
                                        className={`relative aspect-[3/2] h-10 shrink-0 overflow-hidden rounded-lg border-2 bg-ink p-0 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 ${sel ? 'border-brand-600' : 'border-transparent hover:border-brand-300'}`}
                                    >
                                        <img src={shot.image} alt="" className="h-full w-full object-cover" />
                                        <ScoreBadge shot={shot} className="absolute bottom-0.5 right-0.5" />
                                        {shot.status === 'grading' && (
                                            <span className="absolute inset-0 flex items-center justify-center bg-ink/50 text-ink-foreground"><Loader2 size={14} className="animate-spin" /></span>
                                        )}
                                        {shot.status === 'error' && (
                                            <span className="absolute bottom-0.5 right-0.5 rounded-md bg-ink/70 p-0.5 text-ink-foreground"><AlertCircle size={11} /></span>
                                        )}
                                    </button>
                                )
                            })}
                            {shots.length > 0 && (
                                <button
                                    type="button"
                                    aria-pressed={galleryOpen}
                                    onClick={() => useStudioSession.getState().setGallery(!galleryOpen)}
                                    className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold text-muted-foreground transition hover:text-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                                >
                                    <Images size={14} /> Xem tất cả
                                </button>
                            )}
                        </div>
                        {shots.length > 0 && (
                            <button
                                type="button"
                                disabled={gradeDisabled}
                                onClick={() => selected && void gradeShot(selected.id)}
                                className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-brand-200 px-4 text-sm font-bold text-brand-ink transition hover:bg-brand-50 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                            >
                                <Sparkles size={15} /> {gradeLabel}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {viewing && selected && (
                    <ShotViewer
                        key="viewer"
                        shot={selected}
                        index={selectedIndex}
                        total={shots.length}
                        brief={STUDIO_BRIEFS[shotBriefIndex] ?? brief}
                        briefIndex={shotBriefIndex}
                        briefCount={STUDIO_BRIEFS.length}
                        onClose={() => useStudioSession.getState().openDrawer(false)}
                        onReuse={reuseSetup}
                        onDelete={deleteShot}
                        onTry={(change) => {
                            setSetup((cur) => applyChange(cur, change))
                            useStudioSession.getState().openDrawer(false)
                            showToast(`Đã áp vào studio: ${describeChange(change)}. Xem lại cảnh rồi chụp lại nhé.`, undefined, 4500)
                        }}
                    />
                )}
            </AnimatePresence>

            {pickerOpen && <BriefPicker briefs={STUDIO_BRIEFS} currentId={brief.id} best={briefBest} onPick={pickBrief} onClose={() => setPickerOpen(false)} />}
            {toast && (
                <div role="status" className="fixed bottom-5 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-3 rounded-full bg-ink px-4 py-2.5 text-sm text-ink-foreground shadow-raised">
                    {toast.message}
                    {toast.undo && (
                        <button type="button" onClick={toast.undo} className="rounded-full bg-ink-foreground/15 px-3 py-1 text-xs font-bold transition hover:bg-ink-foreground/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70">
                            Hoàn tác
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}
/** Lớp phủ trên canvas khi AI dựng ánh sáng (vệt quét, đèn nhấp nháy, 3 bước) và thẻ thông báo khi lỗi. */
function EnvOverlay({ env, step, onRetry, onClose }: { env: EnvState; step: number; onRetry: () => void; onClose: () => void }) {
    if (env.kind === 'idle') return null
    const loading = env.kind === 'loading'
    return (
        <div className="absolute inset-0 z-20" aria-live="polite">
            {loading && (
                <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
                    <div className="studio-veil absolute inset-0 bg-ink/35" />
                    <div className="studio-scan absolute inset-y-0 w-[30%] bg-gradient-to-r from-transparent via-brand-light/20 to-transparent" />
                    {[['22%', '20%', '0s'], ['74%', '26%', '.3s'], ['50%', '12%', '.6s']].map(([left, top, delay]) => (
                        <span
                            key={left}
                            className="studio-bulb absolute h-3.5 w-3.5 rounded-full bg-brand-light shadow-[0_0_0_6px_hsl(var(--brand-light)/0.18),0_0_30px_8px_hsl(var(--brand-light)/0.5)]"
                            style={{ left, top, animationDelay: delay }}
                        />
                    ))}
                </div>
            )}
            <div className={`absolute left-1/2 top-1/2 w-[min(320px,calc(100%-24px))] -translate-x-1/2 -translate-y-1/2 rounded-2xl px-[18px] py-4 shadow-raised ${glass}`}>
                {loading ? (
                    <>
                        <h3 className="mb-3 text-xs font-extrabold uppercase tracking-[0.12em] text-brand-light">AI đang dựng ánh sáng</h3>
                        <ol className="flex flex-col gap-2 text-sm">
                            {ENV_STEPS.map((label, i) => (
                                <li key={label} className={`flex items-center gap-2.5 transition-opacity duration-base ${i <= step ? 'opacity-100' : 'opacity-45'}`}>
                                    {i < step ? (
                                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-success text-success-foreground"><Check size={10} strokeWidth={3} /></span>
                                    ) : i === step ? (
                                        <span className="studio-spin h-4 w-4 rounded-full border-2 border-brand-light border-t-transparent" />
                                    ) : (
                                        <span className="h-4 w-4 rounded-full border-2 border-ink-foreground/50" />
                                    )}
                                    {label}
                                </li>
                            ))}
                        </ol>
                    </>
                ) : (
                    <div role={env.kind === 'error' ? 'alert' : 'status'}>
                        <p className="flex gap-2 text-sm leading-relaxed">
                            {env.kind === 'error' ? <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden /> : <Info size={16} className="mt-0.5 shrink-0" aria-hidden />}
                            {env.message}
                        </p>
                        <div className="mt-3 flex gap-2">
                            {env.kind === 'error' && (
                                <button type="button" onClick={onRetry} className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-[13px] font-bold text-ink-foreground transition hover:bg-brand-700">
                                    <RotateCcw size={13} /> Thử lại
                                </button>
                            )}
                            <button type="button" onClick={onClose} className="inline-flex items-center gap-1.5 rounded-full border border-ink-foreground/25 px-4 py-2 text-[13px] font-bold transition hover:bg-ink-foreground/10">
                                <X size={13} /> Đóng
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

/** Ý đồ gửi kèm khi chấm: mô tả đã dùng với AI (nếu có) và đèn có bị chỉnh tay sau đó không. */
function buildIntent(setup: CameraSetup, applied: { prompt: string; explanation: string; setup: CameraSetup } | null): LightingIntent {
    const base = { background: setup.look.background, fogDensity: setup.look.fogDensity }
    if (!applied) return base
    const a = applied.setup
    const tweaked = a.key !== setup.key || a.fill !== setup.fill || a.rim !== setup.rim || a.keyAngleDeg !== setup.keyAngleDeg
    return { ...base, prompt: applied.prompt, explanation: applied.explanation, tweaked }
}
