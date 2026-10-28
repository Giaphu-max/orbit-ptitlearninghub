import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertCircle, Camera, Check, Grid3x3, Images, Info, Loader2, RotateCcw, Sparkles, X } from 'lucide-react'
import type { LightingIntent } from '@/lib/api-types'
import { ApiRequestError, generateEnvironment, isNotLightingError } from '@/lib/api'
import { ENV_LIMITS } from '@/lib/environment'
import { DIRECTOR_MIN_SCORE } from '@/lib/gamification'
import { SFX } from '@/lib/sfx'
import { getStudioBrief } from '@/lib/studio-briefs'
import { getConcept } from '@/data'
import { useOrbitStore } from '@/store/useOrbitStore'
import { gradeShot, SHOTS_MAX, useStudioSession, type StudioShot } from '@/store/useStudioSession'
import { DEFAULT_SETUP, setupFromEnvironment, type CameraSetup } from '@/lib/studio-setup'
import { GalleryPanel, ScoreBadge } from '@/components/studio/gallery-panel'
import { Lightbox } from '@/components/studio/lightbox'
import { ShotDrawer } from '@/components/studio/shot-drawer'
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
const DEFAULT_BRIEF = 'Chụp chân dung với chủ thể ở giao điểm một phần ba, ánh sáng đúng ý đồ bạn chọn (tự chỉnh đèn hoặc mô tả bằng lời).'

type EnvState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'error' | 'hint'; message: string }

const glass = 'border border-ink-foreground/15 bg-ink/60 text-ink-foreground backdrop-blur-md'

/** /studio – Virtual Director: một màn hình làm việc. Chỉnh máy và đèn, chụp (không gọi API), chọn ảnh trong dải phim để AI chấm. */
export function OrbitStudioView() {
    const [setup, setSetup] = useState<CameraSetup>(DEFAULT_SETUP)
    const [grid, setGrid] = useState(true)
    const [tab, setTab] = useState<RailTab>('camera')
    const captureRef = useRef<CaptureFn | null>(null)
    const viewportRef = useRef<HTMLDivElement>(null)
    const stripRef = useRef<HTMLDivElement>(null)
    const flashRef = useRef<HTMLDivElement>(null)
    const directorBest = useOrbitStore((s) => s.directorBest)
    const [webgl] = useState(canRender3D)
    const [envPrompt, setEnvPrompt] = useState('')
    const [searchParams, setSearchParams] = useSearchParams()
    const brief = getStudioBrief(searchParams.get('concept'))
    const briefConcept = brief ? getConcept(brief.conceptId) : undefined
    const [env, setEnv] = useState<EnvState>({ kind: 'idle' })
    const [envStep, setEnvStep] = useState(0)
    // Ý đồ ánh sáng đã áp dụng (giữ lại khi lần sau bị từ chối hoặc lỗi)
    const [applied, setApplied] = useState<{ prompt: string; explanation: string; setup: CameraSetup } | null>(null)
    const envBusy = useRef(false)
    const lastEnvAt = useRef(0)
    const lastPrompt = useRef('')

    const { shots, selectedId, drawerOpen, galleryOpen } = useStudioSession()
    const selected = shots.find((s) => s.id === selectedId)
    const selectedIndex = shots.findIndex((s) => s.id === selectedId)
    const [toast, setToast] = useState<{ message: string; undo?: () => void } | null>(null)
    const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
    const tweenRaf = useRef(0)
    const loading = env.kind === 'loading'

    const onReady = useCallback((fn: CaptureFn) => {
        captureRef.current = fn
    }, [])

    // Esc đóng lớp trên cùng trước: lightbox → bảng lưới → ngăn Xem ảnh
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return
            const st = useStudioSession.getState()
            if (st.lightboxOpen) st.setLightbox(false)
            else if (st.galleryOpen) st.setGallery(false)
            else if (st.drawerOpen) st.openDrawer(false)
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [])

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
        const id = useStudioSession.getState().addShot({ image: dataUrl, base64, setup, intent })
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

    return (
        <div className="w-full overflow-x-clip min-[980px]:h-[calc(100svh-var(--nav-h))]">
            <div className="container-wide grid gap-4 py-4 min-[980px]:h-full min-[980px]:grid-cols-[minmax(0,1fr)_340px]">
                <section className="flex min-h-0 min-w-0 flex-col gap-3" aria-label="Khung làm việc studio">
                    {/* Chỉ dẫn 3 bước cho người mới */}
                    <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-card border border-border bg-card px-4 py-2.5 text-xs font-semibold text-muted-foreground shadow-sm">
                        <div className="flex items-center gap-2 overflow-x-auto">
                            <span className="flex items-center gap-1.5 font-bold text-brand-ink">
                                <span className="font-mono text-sm">①</span> Chọn đề bài & Dựng sáng
                            </span>
                            <span className="text-xs text-muted-foreground/40">→</span>
                            <span className="flex items-center gap-1.5 font-semibold text-foreground">
                                <span className="font-mono text-sm">②</span> Căn góc & Chụp ảnh
                            </span>
                            <span className="text-xs text-muted-foreground/40">→</span>
                            <span className="flex items-center gap-1.5 font-semibold text-foreground">
                                <span className="font-mono text-sm">③</span> AI Chấm điểm
                            </span>
                        </div>
                        <span className="hidden text-[11px] font-medium text-muted-foreground min-[1180px]:inline">
                            Phòng Lab 3D · Môn Nhiếp ảnh & Ánh sáng PTIT
                        </span>
                    </div>

                    {/* Dải đề bài một dòng */}
                    <div className="flex items-center gap-3 rounded-card border border-border bg-card px-4 py-2.5 shadow-card">
                        <span className="shrink-0 text-eyebrow uppercase text-brand-ink">Đề bài</span>
                        <p className="min-w-0 flex-1 text-sm leading-snug text-foreground min-[980px]:truncate" title={brief?.task ?? DEFAULT_BRIEF}>
                            {briefConcept && brief ? <><b className="font-bold">{briefConcept.name}.</b> {brief.task}</> : DEFAULT_BRIEF}
                        </p>
                        <span className="hidden shrink-0 whitespace-nowrap font-mono text-xs text-muted-foreground sm:block">
                            Kỷ lục <b className="text-foreground">{directorBest > 0 ? directorBest : '—'}</b> · đạt ≥{DIRECTOR_MIN_SCORE}
                        </span>
                        <button
                            type="button"
                            onClick={() => setTab('brief')}
                            className="shrink-0 rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-bold text-foreground transition hover:border-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                        >
                            Đổi đề
                        </button>
                    </div>

                    {/* Canvas 3D */}
                    <div ref={viewportRef} style={{ viewTransitionName: 'vt-studio-stage' }} className="relative h-[56vh] overflow-hidden rounded-panel bg-ink shadow-card min-[980px]:h-auto min-[980px]:min-h-0 min-[980px]:flex-1">
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

                        {/* Gợi ý và thanh AI Prompt-to-Environment; mờ đi và khóa khi AI đang dựng đèn */}
                        <div className={`absolute inset-x-3 bottom-4 mx-auto flex max-w-[680px] flex-col gap-2 transition-opacity duration-base ${loading ? 'pointer-events-none opacity-55' : ''}`} aria-busy={loading}>
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
                                    void applyEnvironment(envPrompt)
                                }}
                            >
                                <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-ink-foreground">
                                    <Sparkles size={16} />
                                </span>
                                <input
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
                        </div>

                        {galleryOpen && <GalleryPanel />}
                        <EnvOverlay env={env} step={envStep} onRetry={() => void applyEnvironment(lastPrompt.current, true)} onClose={() => setEnv({ kind: 'idle' })} />
                        <div ref={flashRef} aria-hidden className="pointer-events-none absolute inset-0 bg-ink-foreground opacity-0" />
                    </div>

                    {/* Thanh dưới: Chụp / dải phim / Chấm */}
                    <div className="flex flex-wrap items-center gap-3 rounded-panel border border-border bg-card p-2.5 shadow-card sm:flex-nowrap">
                        <button
                            type="button"
                            onClick={shoot}
                            disabled={!webgl}
                            className="inline-flex shrink-0 items-center gap-2.5 rounded-xl bg-brand-600 px-6 py-3.5 text-base font-extrabold text-ink-foreground shadow-brand transition hover:bg-brand-700 active:scale-[0.98] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 ring-2 ring-brand-500/30"
                        >
                            <Camera size={18} /> Chụp ảnh
                        </button>
                        <p className="hidden shrink-0 font-mono text-xs text-muted-foreground sm:block" aria-live="polite">{shots.length} ảnh</p>
                        <div
                            ref={stripRef}
                            aria-label={`Ảnh đã chụp, ${shots.length} ảnh`}
                            className="order-last flex min-w-0 basis-full gap-2 overflow-x-auto p-0.5 [scrollbar-width:thin] sm:order-none sm:basis-0 sm:flex-1"
                        >
                            {shots.length === 0 && <div className="flex aspect-[3/2] h-16 items-center justify-center rounded-xl border-[1.5px] border-dashed border-border px-3 text-xs text-muted-foreground">Chưa có ảnh nào</div>}
                            {shots.map((shot, i) => {
                                const sel = shot.id === selectedId
                                return (
                                    <button
                                        key={shot.id}
                                        type="button"
                                        data-shot-id={shot.id}
                                        aria-pressed={sel}
                                        aria-label={`Ảnh ${i + 1}${shot.status === 'done' ? `, ${shot.result?.overall} điểm` : shot.status === 'grading' ? ', đang chấm' : ', chưa chấm'}`}
                                        onClick={() => useStudioSession.getState().select(shot.id)}
                                        className={`relative aspect-[3/2] w-24 shrink-0 overflow-hidden rounded-xl border-2 bg-ink p-0 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 ${sel ? 'border-brand-600' : 'border-transparent hover:border-brand-300'}`}
                                    >
                                        <img src={shot.image} alt="" className="h-full w-full object-cover" />
                                        <span className="absolute left-1 top-1 rounded-md bg-ink/70 px-1.5 py-0.5 font-mono text-[10px] text-ink-foreground">{i + 1}</span>
                                        <ScoreBadge shot={shot} className="absolute bottom-1 right-1" />
                                        {shot.status === 'grading' && (
                                            <span className="absolute inset-0 flex items-center justify-center bg-ink/50 text-ink-foreground"><Loader2 size={16} className="animate-spin" /></span>
                                        )}
                                        {shot.status === 'error' && (
                                            <span className="absolute bottom-1 right-1 rounded-md bg-ink/70 p-1 text-ink-foreground"><AlertCircle size={12} /></span>
                                        )}
                                    </button>
                                )
                            })}
                            {shots.length > 0 && (
                                <button
                                    type="button"
                                    aria-pressed={galleryOpen}
                                    onClick={() => useStudioSession.getState().setGallery(!galleryOpen)}
                                    className="flex aspect-[3/2] w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-xs font-bold text-foreground transition hover:border-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                                >
                                    <Images size={16} /> Xem tất cả
                                </button>
                            )}
                        </div>
                        <button
                            type="button"
                            disabled={gradeDisabled}
                            onClick={() => selected && void gradeShot(selected.id)}
                            className={`ml-auto inline-flex shrink-0 items-center gap-2 rounded-xl px-5 py-3 text-sm font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:ml-0 ${
                                gradeDisabled
                                    ? 'border border-border bg-muted text-muted-foreground/50 cursor-not-allowed opacity-50'
                                    : 'border-2 border-brand-500/60 bg-brand-50 text-brand-ink shadow-sm hover:bg-brand-100 hover:border-brand-600 dark:bg-brand-950/40'
                            }`}
                        >
                            <Sparkles size={16} className={!gradeDisabled ? 'text-brand-600 animate-pulse' : ''} /> {gradeLabel}
                        </button>
                    </div>
                </section>

                <div className="relative min-h-0 min-w-0">
                    <StudioRail
                        tab={tab}
                        onTab={setTab}
                        setup={setup}
                        onSetup={setSetup}
                        brief={brief}
                        onPickConcept={(id) => setSearchParams({ concept: id }, { replace: true })}
                        envLoading={loading}
                        onApplyLighting={askLighting}
                        explanation={applied?.explanation ?? null}
                    />
                    <ShotDrawer
                        shot={selected}
                        index={selectedIndex}
                        total={shots.length}
                        open={drawerOpen && Boolean(selected)}
                        onClose={() => useStudioSession.getState().openDrawer(false)}
                        onReuse={reuseSetup}
                        onDelete={deleteShot}
                    />
                </div>
            </div>

            <Lightbox onReuse={reuseSetup} onDelete={deleteShot} />
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

function elevationLabel(deg: number) {
    if (Math.abs(deg) <= 3) return 'ngang mắt'
    return deg > 0 ? `góc cao ${deg}°` : `góc thấp ${Math.abs(deg)}°`
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
