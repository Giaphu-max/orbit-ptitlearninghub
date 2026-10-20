import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertCircle, Camera, Check, Grid3x3, Info, Loader2, RotateCcw, Sparkles, X } from 'lucide-react'
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
import { GradeDrawer } from '@/components/studio/grade-drawer'
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

    const { shots, selectedId, drawerOpen } = useStudioSession()
    const selected = shots.find((s) => s.id === selectedId)
    const loading = env.kind === 'loading'

    const onReady = useCallback((fn: CaptureFn) => {
        captureRef.current = fn
    }, [])

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
        const { dataUrl, base64 } = capture()
        const intent = buildIntent(setup, applied)
        const id = useStudioSession.getState().addShot({ image: dataUrl, base64, setup, intent })
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

    const retake = (shot: StudioShot) => {
        setSetup(shot.setup)
        useStudioSession.getState().openDrawer(false)
    }

    const gradeLabel = !selected ? 'Chấm ảnh này' : selected.status === 'done' ? 'Đã chấm' : selected.status === 'grading' ? 'Đang chấm…' : 'Chấm ảnh này'
    const gradeDisabled = !selected || selected.status === 'done' || selected.status === 'grading'

    return (
        <div className="w-full overflow-x-clip min-[980px]:h-[calc(100svh-var(--nav-h))]">
            <div className="mx-auto grid max-w-[1600px] gap-4 p-4 min-[980px]:h-full min-[980px]:grid-cols-[minmax(0,1fr)_340px]">
                <section className="flex min-h-0 min-w-0 flex-col gap-3" aria-label="Khung làm việc studio">
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
                    <div ref={viewportRef} className="relative h-[56vh] overflow-hidden rounded-panel bg-ink shadow-card min-[980px]:h-auto min-[980px]:min-h-0 min-[980px]:flex-1">
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

                        <EnvOverlay env={env} step={envStep} onRetry={() => void applyEnvironment(lastPrompt.current, true)} onClose={() => setEnv({ kind: 'idle' })} />
                        <div ref={flashRef} aria-hidden className="pointer-events-none absolute inset-0 bg-ink-foreground opacity-0" />
                    </div>

                    {/* Thanh dưới: Chụp / dải phim / Chấm */}
                    <div className="flex flex-wrap items-center gap-3 rounded-panel border border-border bg-card p-2.5 shadow-card sm:flex-nowrap">
                        <button
                            type="button"
                            onClick={shoot}
                            disabled={!webgl}
                            className="inline-flex shrink-0 items-center gap-2.5 rounded-card bg-brand-600 px-5 py-3 text-sm font-extrabold text-ink-foreground shadow-brand transition hover:bg-brand-700 active:scale-[0.98] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                        >
                            <Camera size={17} /> Chụp
                        </button>
                        <div
                            ref={stripRef}
                            aria-label={`Ảnh đã chụp, ${shots.length}/${SHOTS_MAX}`}
                            className="order-last flex min-w-0 basis-full gap-2 overflow-x-auto p-0.5 [scrollbar-width:none] sm:order-none sm:basis-0 sm:flex-1"
                        >
                            {Array.from({ length: SHOTS_MAX }, (_, i) => {
                                const shot = shots[i]
                                if (!shot) return <div key={`e${i}`} aria-hidden className="aspect-[3/2] w-24 shrink-0 rounded-xl border-[1.5px] border-dashed border-border" />
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
                                        {shot.status === 'done' && (
                                            <span className={`absolute bottom-1 right-1 rounded-md px-1.5 py-0.5 font-mono text-[11px] font-bold ${(shot.result?.overall ?? 0) >= DIRECTOR_MIN_SCORE ? 'bg-success text-success-foreground' : 'bg-ink/70 text-ink-foreground'}`}>
                                                {shot.result?.overall}
                                            </span>
                                        )}
                                        {shot.status === 'grading' && (
                                            <span className="absolute inset-0 flex items-center justify-center bg-ink/50 text-ink-foreground"><Loader2 size={16} className="animate-spin" /></span>
                                        )}
                                        {shot.status === 'error' && (
                                            <span className="absolute bottom-1 right-1 rounded-md bg-ink/70 p-1 text-ink-foreground"><AlertCircle size={12} /></span>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                        <button
                            type="button"
                            disabled={gradeDisabled}
                            onClick={() => selected && void gradeShot(selected.id)}
                            className="ml-auto inline-flex shrink-0 items-center gap-2 rounded-card border border-border bg-muted px-4 py-3 text-sm font-extrabold text-foreground transition hover:border-brand-300 disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:ml-0"
                        >
                            {selected?.status === 'done' ? <Check size={16} /> : <Sparkles size={16} />} {gradeLabel}
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
                    <GradeDrawer shot={selected} open={drawerOpen && Boolean(selected)} onClose={() => useStudioSession.getState().openDrawer(false)} onRetake={retake} />
                </div>
            </div>
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
        <div className="absolute inset-0" aria-live="polite">
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
