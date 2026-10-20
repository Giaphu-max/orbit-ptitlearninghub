import { lazy, Suspense, useCallback, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Camera, Grid3x3, Info, Loader2, RotateCcw, Sparkles } from 'lucide-react'
import type { GradePhotoResponse, LightingIntent } from '@/lib/api-types'
import { ApiRequestError, generateEnvironment, gradePhoto, isNotLightingError } from '@/lib/api'
import { ENV_LIMITS } from '@/lib/environment'
import { announceRewards, directorScreen, DIRECTOR_MIN_SCORE } from '@/lib/gamification'
import { getStudioBrief, studioBriefsWithConcept } from '@/lib/studio-briefs'
import { getConcept, lessons } from '@/data'
import { useOrbitStore } from '@/store/useOrbitStore'
import { DEFAULT_SETUP, setupFromEnvironment, type CameraSetup } from '@/lib/studio-setup'
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

const ENV_COOLDOWN_MS = 1500
const ENV_SUGGESTIONS = ['Hoàng hôn gắt, bóng đổ dài', 'Ánh sáng studio mềm chụp chân dung', 'Đêm có sương, đèn viền lạnh', 'Nắng trưa gắt từ trên cao']

interface Shot {
    image: string
    result: GradePhotoResponse
    at: number
}
const HISTORY_MAX = 6

type Phase =
    | { kind: 'live' }
    | { kind: 'grading'; image: string }
    | { kind: 'result'; image: string; result: GradePhotoResponse }
    | { kind: 'error'; message: string }

/** /studio – Virtual Director: chỉnh máy ảnh và đèn trong studio 3D, chụp, AI chấm bố cục và ánh sáng. */
export function OrbitStudioView() {
    const [setup, setSetup] = useState<CameraSetup>(DEFAULT_SETUP)
    const [grid, setGrid] = useState(true)
    const [phase, setPhase] = useState<Phase>({ kind: 'live' })
    // Ảnh đã chụp trong phiên này (không lưu lại), mới nhất ở đầu
    const [shots, setShots] = useState<Shot[]>([])
    const captureRef = useRef<CaptureFn | null>(null)
    const directorBest = useOrbitStore((s) => s.directorBest)
    const [webgl] = useState(canRender3D)
    const [envPrompt, setEnvPrompt] = useState('')
    const [searchParams, setSearchParams] = useSearchParams()
    const brief = getStudioBrief(searchParams.get('concept'))
    const briefConcept = brief ? getConcept(brief.conceptId) : undefined
    const [envLoading, setEnvLoading] = useState(false)
    // Ý đồ ánh sáng đã áp dụng (giữ lại khi lần sau bị từ chối hoặc lỗi) và thông báo của lần gọi gần nhất
    const [applied, setApplied] = useState<{ prompt: string; explanation: string; setup: CameraSetup } | null>(null)
    const [envNotice, setEnvNotice] = useState<{ kind: 'hint' | 'error'; message: string } | null>(null)
    const envBusy = useRef(false)
    const lastEnvAt = useRef(0)

    const onReady = useCallback((fn: CaptureFn) => {
        captureRef.current = fn
    }, [])
    const set = <K extends keyof CameraSetup>(key: K) => (value: number) => setSetup((s) => ({ ...s, [key]: value }))

    const shoot = async () => {
        const capture = captureRef.current
        if (!capture || phase.kind === 'grading') return
        const { dataUrl, base64 } = capture()
        setPhase({ kind: 'grading', image: dataUrl })
        try {
            // Chỉ gửi thông số nhiếp ảnh; dịch khung đã thể hiện trong ảnh
            const { shiftX: _x, shiftY: _y, look: _look, ...director } = setup
            const result = await gradePhoto({ imageBase64: base64, setup: director, intent: buildIntent(setup, applied) })
            const before = useOrbitStore.getState()
            const xp = before.recordDirectorScore(result.overall)
            const after = useOrbitStore.getState()
            announceRewards(before, after, xp > 0 ? directorScreen(result.overall, result.composition, result.lighting) : undefined)
            setShots((list) => [{ image: dataUrl, result, at: Date.now() }, ...list].slice(0, HISTORY_MAX))
            setPhase({ kind: 'result', image: dataUrl, result })
        } catch (err) {
            setPhase({ kind: 'error', message: err instanceof ApiRequestError ? err.message : 'AI chưa chấm được lúc này. Bạn thử lại nhé.' })
        }
    }

    const applyEnvironment = async (text: string) => {
        const prompt = text.trim()
        // Khóa bằng ref (state cập nhật chậm một nhịp) và chờ một chút giữa hai lần bấm để không đốt hạn mức
        if (!prompt || envBusy.current || Date.now() - lastEnvAt.current < ENV_COOLDOWN_MS) return
        envBusy.current = true
        lastEnvAt.current = Date.now()
        setEnvLoading(true)
        setEnvNotice(null)
        try {
            const spec = await generateEnvironment({ prompt })
            // Chỉ đổi cảnh khi đã có thông số hợp lệ; lỗi thì cảnh cũ được giữ nguyên
            const next = setupFromEnvironment(setup, spec)
            setSetup(next)
            setApplied({ prompt, explanation: spec.explanation, setup: next })
        } catch (err) {
            if (isNotLightingError(err)) {
                setEnvNotice({ kind: 'hint', message: err.message })
            } else {
                setEnvNotice({ kind: 'error', message: err instanceof ApiRequestError ? err.message : 'AI chưa tạo được ánh sáng lúc này, cảnh được giữ nguyên. Bạn thử lại nhé.' })
            }
        } finally {
            envBusy.current = false
            lastEnvAt.current = Date.now()
            setEnvLoading(false)
        }
    }

    const showing = phase.kind === 'grading' || phase.kind === 'result'

    return (
        <div className="w-full">
            <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-8 lg:px-8 lg:py-12">
                <header>
                    <p className="text-eyebrow uppercase text-brand-ink">Virtual Director</p>
                    <h1 className="mt-3 text-headline text-foreground">Đặt máy, đặt đèn, rồi để AI chấm.</h1>
                    <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
                        Đề bài: chụp chân dung nhân vật với chủ thể ở giao điểm một phần ba, ánh sáng đúng ý đồ bạn chọn (tự chỉnh đèn hoặc mô tả bằng lời). Đạt từ {DIRECTOR_MIN_SCORE} điểm và vượt kỷ lục của bạn để nhận XP.
                        {directorBest > 0 && (
                            <> Kỷ lục hiện tại: <span className="font-mono font-bold text-foreground">{directorBest}</span>.</>
                        )}
                    </p>
                </header>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
                    <div className="flex min-w-0 flex-col gap-5">
                        <div className="relative aspect-[3/2] w-full overflow-hidden rounded-panel bg-ink shadow-card">
                            {webgl ? (
                                <div className={showing ? 'invisible absolute inset-0' : 'absolute inset-0'}>
                                    <Suspense fallback={<div className="flex h-full items-center justify-center text-ink-foreground"><Loader2 className="animate-spin" /></div>}>
                                        <StudioScene setup={setup} onReady={onReady} />
                                    </Suspense>
                                </div>
                            ) : (
                                <p className="flex h-full items-center justify-center px-6 text-center text-sm text-ink-foreground">
                                    Thiết bị này chưa chạy được 3D (không có WebGL). Bạn thử trình duyệt khác nhé.
                                </p>
                            )}
                            {showing && <img src={phase.image} alt="Ảnh vừa chụp trong studio" className="absolute inset-0 h-full w-full object-cover" />}
                            {grid && (
                                <div aria-hidden className="pointer-events-none absolute inset-0">
                                    <div className="absolute inset-y-0 left-1/3 w-px bg-ink-foreground/60" />
                                    <div className="absolute inset-y-0 left-2/3 w-px bg-ink-foreground/60" />
                                    <div className="absolute inset-x-0 top-1/3 h-px bg-ink-foreground/60" />
                                    <div className="absolute inset-x-0 top-2/3 h-px bg-ink-foreground/60" />
                                </div>
                            )}
                            {phase.kind === 'result' &&
                                phase.result.areas.map((a, i) => (
                                    <div
                                        key={i}
                                        className="pointer-events-none absolute rounded-md border-2 border-brand-light"
                                        style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%`, width: `${a.w * 100}%`, height: `${a.h * 100}%` }}
                                    >
                                        <span className="absolute -top-px left-0 max-w-full -translate-y-full rounded-t bg-brand-600 px-2 py-0.5 text-[11px] font-bold text-ink-foreground">
                                            {a.note}
                                        </span>
                                    </div>
                                ))}
                            {phase.kind === 'grading' && (
                                <div className="absolute inset-0 flex items-center justify-center bg-ink/55 text-ink-foreground">
                                    <p className="inline-flex items-center gap-2 text-sm font-bold">
                                        <Loader2 size={18} className="animate-spin" /> AI đang xem ảnh của bạn…
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Thanh thao tác dính ở đáy khung nhìn khi khung 3D dài hơn màn hình: nút chụp luôn nhìn thấy */}
                        <div className="sticky bottom-3 z-20 flex flex-wrap items-center gap-3 rounded-card border border-border bg-card/95 p-3 shadow-raised backdrop-blur">
                            {showing ? (
                                <button
                                    type="button"
                                    onClick={() => setPhase({ kind: 'live' })}
                                    disabled={phase.kind === 'grading'}
                                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-sm font-bold text-ink-foreground shadow-brand transition hover:bg-brand-700 disabled:opacity-50 sm:flex-none"
                                >
                                    <RotateCcw size={16} /> Chụp lại
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={shoot}
                                    disabled={!webgl}
                                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-sm font-bold text-ink-foreground shadow-brand transition hover:bg-brand-700 disabled:opacity-50 sm:flex-none"
                                >
                                    <Camera size={16} /> Chụp và chấm điểm
                                </button>
                            )}
                            <button
                                type="button"
                                aria-pressed={grid}
                                onClick={() => setGrid((g) => !g)}
                                className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-bold text-foreground transition hover:bg-muted"
                            >
                                <Grid3x3 size={15} /> Lưới 1/3 {grid ? 'bật' : 'tắt'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setSetup(DEFAULT_SETUP)}
                                className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-bold text-foreground transition hover:bg-muted"
                            >
                                <RotateCcw size={15} /> Đặt lại
                            </button>
                        </div>

                        {phase.kind === 'error' && (
                            <p role="alert" className="rounded-card border border-border bg-muted px-4 py-3 text-sm text-foreground">{phase.message}</p>
                        )}
                        {phase.kind === 'result' && <Result result={phase.result} />}
                        <ShotHistory shots={shots} activeImage={phase.kind === 'result' ? phase.image : null} onOpen={(shot) => setPhase({ kind: 'result', image: shot.image, result: shot.result })} />
                    </div>

                    <aside className="grid min-w-0 gap-5 md:grid-cols-2 xl:flex xl:flex-col">
                        <Panel title="Máy ảnh">
                            <Slider label="Tiêu cự" unit="mm" min={24} max={135} step={1} value={setup.focalLengthMm} onChange={set('focalLengthMm')} />
                            <Slider label="Xoay quanh chủ thể" unit="°" min={-80} max={80} step={1} value={setup.azimuthDeg} onChange={set('azimuthDeg')} />
                            <Slider label="Độ cao máy" unit="°" min={-5} max={40} step={1} value={setup.elevationDeg} onChange={set('elevationDeg')} />
                            <Slider label="Khoảng cách" unit="m" min={3} max={10} step={0.1} value={setup.distance} onChange={set('distance')} />
                            <Slider label="Dịch khung ngang" min={-0.4} max={0.4} step={0.01} value={setup.shiftX} onChange={set('shiftX')} format={(v) => `${Math.round(v * 100)}%`} />
                            <Slider label="Dịch khung dọc" min={-0.4} max={0.4} step={0.01} value={setup.shiftY} onChange={set('shiftY')} format={(v) => `${Math.round(v * 100)}%`} />
                        </Panel>
                        <Panel title="Đề bài theo khái niệm">
                            {brief && briefConcept && (
                                <div className="rounded-card border border-brand-100 bg-brand-50 px-4 py-3">
                                    <p className="text-eyebrow uppercase text-brand-ink">{briefConcept.name}</p>
                                    <p className="mt-1.5 text-sm leading-relaxed text-foreground">{brief.task}</p>
                                    <button
                                        type="button"
                                        disabled={envLoading}
                                        onClick={() => {
                                            setEnvPrompt(brief.lighting)
                                            void applyEnvironment(brief.lighting)
                                        }}
                                        className="mt-3 inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-[13px] font-bold text-ink-foreground transition hover:bg-brand-700 disabled:opacity-50"
                                    >
                                        <Sparkles size={14} /> Tạo ánh sáng gợi ý
                                    </button>
                                    {(() => {
                                        const src = lessons.find((l) => l.concepts.some((c) => c.id === brief.conceptId))
                                        return src ? (
                                            <Link to={`/lesson/${src.id}?t=${briefConcept.segment.start}`} className="mt-2 block text-xs font-semibold text-brand-ink hover:underline">
                                                Xem lại đoạn giảng trong bài
                                            </Link>
                                        ) : null
                                    })()}
                                </div>
                            )}
                            <ul className="flex flex-wrap gap-2" aria-label="Chọn khái niệm để thực hành">
                                {studioBriefsWithConcept().map((b) => (
                                    <li key={b.conceptId}>
                                        <button
                                            type="button"
                                            aria-pressed={brief?.conceptId === b.conceptId}
                                            onClick={() => setSearchParams({ concept: b.conceptId }, { replace: true })}
                                            className={`rounded-full border px-3 py-1.5 text-left text-[12px] font-semibold transition ${
                                                brief?.conceptId === b.conceptId ? 'border-brand-600 bg-brand-50 text-brand-ink' : 'border-border bg-card text-foreground hover:border-brand-300'
                                            }`}
                                        >
                                            {b.conceptName}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                            {!brief && <p className="text-xs text-muted-foreground">Chọn một khái niệm của khóa Nhiếp ảnh và ánh sáng để nhận đề bài và gợi ý ánh sáng.</p>}
                        </Panel>
                        <Panel title="Mô tả ánh sáng bằng lời">
                            <form
                                className="flex flex-col gap-3"
                                onSubmit={(e) => {
                                    e.preventDefault()
                                    void applyEnvironment(envPrompt)
                                }}
                            >
                                <label className="block">
                                    <span className="sr-only">Mô tả ánh sáng</span>
                                    <textarea
                                        value={envPrompt}
                                        onChange={(e) => setEnvPrompt(e.target.value)}
                                        maxLength={ENV_LIMITS.promptMaxChars}
                                        rows={2}
                                        placeholder="Ví dụ: hoàng hôn gắt, bóng đổ dài"
                                        className="w-full resize-none rounded-md border border-input bg-card px-3 py-2 text-[15px] text-foreground transition duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                                    />
                                </label>
                                <ul className="flex flex-wrap gap-2" aria-label="Gợi ý nhanh">
                                    {ENV_SUGGESTIONS.map((t) => (
                                        <li key={t}>
                                            <button
                                                type="button"
                                                disabled={envLoading}
                                                onClick={() => {
                                                    setEnvPrompt(t)
                                                    void applyEnvironment(t)
                                                }}
                                                className="rounded-full border border-border bg-card px-3 py-1.5 text-left text-[12px] font-semibold text-foreground transition hover:border-brand-300 disabled:opacity-50"
                                            >
                                                {t}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                                <button
                                    type="submit"
                                    disabled={envLoading || !envPrompt.trim()}
                                    className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-bold text-background transition hover:opacity-90 disabled:opacity-50"
                                >
                                    {envLoading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                                    {envLoading ? 'AI đang bố trí đèn…' : 'Tạo ánh sáng'}
                                </button>
                            </form>
                            {envNotice?.kind === 'error' && (
                                <p role="alert" className="rounded-card border border-border bg-muted px-4 py-3 text-sm text-foreground">{envNotice.message}</p>
                            )}
                            {envNotice?.kind === 'hint' && (
                                <p role="status" className="flex gap-2 text-[13px] leading-relaxed text-muted-foreground">
                                    <Info size={15} className="mt-0.5 shrink-0" aria-hidden /> {envNotice.message}
                                </p>
                            )}
                            {applied && (
                                <div role="status" className="rounded-card border border-brand-100 bg-brand-50 px-4 py-3">
                                    <p className="text-eyebrow uppercase text-brand-ink">Vì sao chọn vậy</p>
                                    <p className="mt-1.5 text-sm leading-relaxed text-foreground">{applied.explanation}</p>
                                    <p className="mt-2 text-xs text-muted-foreground">Bạn vẫn chỉnh tiếp được bằng thanh trượt bên dưới.</p>
                                </div>
                            )}
                        </Panel>
                        <Panel title="Chỉnh đèn">
                            <Slider label="Đèn chính" unit="%" min={0} max={100} step={1} value={setup.key} onChange={set('key')} />
                            <Slider label="Góc đèn chính" unit="°" min={-90} max={90} step={1} value={setup.keyAngleDeg} onChange={set('keyAngleDeg')} />
                            <Slider label="Đèn phụ (làm dịu bóng)" unit="%" min={0} max={100} step={1} value={setup.fill} onChange={set('fill')} />
                            <Slider label="Đèn viền (tách khỏi phông)" unit="%" min={0} max={100} step={1} value={setup.rim} onChange={set('rim')} />
                        </Panel>

                    </aside>
                </div>
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

/** Ảnh đã chụp trong phiên: bấm để xem lại ảnh và nhận xét. Khi chưa có ảnh thì hiện chỗ trống có hướng dẫn. */
function ShotHistory({ shots, activeImage, onOpen }: { shots: Shot[]; activeImage: string | null; onOpen: (shot: Shot) => void }) {
    return (
        <section aria-labelledby="shots-title" className="rounded-card border border-border bg-card p-5 shadow-card">
            <div className="flex items-baseline justify-between gap-3">
                <h2 id="shots-title" className="text-sm font-bold text-foreground">Ảnh đã chụp</h2>
                <p className="font-mono text-xs text-muted-foreground">{shots.length}/{HISTORY_MAX}</p>
            </div>
            {shots.length === 0 ? (
                <p className="mt-3 rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                    Chưa có ảnh nào. Mỗi lần chụp và chấm, ảnh cùng điểm sẽ nằm ở đây để bạn so sánh giữa các lần chỉnh đèn.
                </p>
            ) : (
                <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {shots.map((shot, i) => (
                        <li key={shot.at}>
                            <button
                                type="button"
                                onClick={() => onOpen(shot)}
                                aria-label={`Xem lại ảnh chụp lần ${shots.length - i}, ${shot.result.overall} điểm`}
                                aria-pressed={activeImage === shot.image}
                                className={`group relative block w-full overflow-hidden rounded-xl border-2 transition ${activeImage === shot.image ? 'border-brand-600' : 'border-transparent hover:border-brand-300'}`}
                            >
                                <img src={shot.image} alt="" className="aspect-[3/2] w-full object-cover" />
                                <span className="absolute bottom-1.5 right-1.5 rounded-full bg-ink/80 px-2 py-0.5 font-mono text-xs font-bold text-ink-foreground">{shot.result.overall}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="rounded-card border border-border bg-card p-5 shadow-card">
            <h2 className="text-sm font-bold text-foreground">{title}</h2>
            <div className="mt-4 flex flex-col gap-4">{children}</div>
        </section>
    )
}

interface SliderProps {
    label: string
    unit?: string
    min: number
    max: number
    step: number
    value: number
    onChange: (v: number) => void
    format?: (v: number) => string
}

function Slider({ label, unit = '', min, max, step, value, onChange, format }: SliderProps) {
    return (
        <label className="block">
            <span className="flex items-baseline justify-between text-[13px] text-muted-foreground">
                {label}
                <span className="font-mono font-bold text-foreground">{format ? format(value) : `${step < 1 ? value.toFixed(1) : value}${unit}`}</span>
            </span>
            <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1.5 w-full accent-brand-600" />
        </label>
    )
}

function Score({ label, value }: { label: string; value: number }) {
    return (
        <div>
            <p className="text-eyebrow uppercase text-muted-foreground">{label}</p>
            <p className="mt-1 font-mono text-4xl font-bold leading-none text-foreground">{value}</p>
        </div>
    )
}

function Result({ result }: { result: GradePhotoResponse }) {
    const passed = result.overall >= DIRECTOR_MIN_SCORE
    return (
        <section aria-label="Kết quả chấm điểm" className="rounded-panel border border-border bg-card p-6 shadow-card">
            <div className="flex flex-wrap items-end gap-8">
                <div>
                    <p className="text-eyebrow uppercase text-brand-ink">Điểm tổng</p>
                    <p className="mt-1 font-mono text-6xl font-bold leading-none text-brand-ink">{result.overall}</p>
                </div>
                <Score label="Bố cục" value={result.composition} />
                <Score label="Ánh sáng" value={result.lighting} />
                <p className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-muted px-4 py-2 text-sm font-bold text-foreground">
                    <Sparkles size={15} /> {passed ? 'Đạt mức nhận XP' : `Cần từ ${DIRECTOR_MIN_SCORE} điểm để nhận XP`}
                </p>
            </div>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <div>
                    <h3 className="text-sm font-bold text-foreground">Bố cục</h3>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">{result.compositionComment}</p>
                </div>
                <div>
                    <h3 className="text-sm font-bold text-foreground">Ánh sáng</h3>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">{result.lightingComment}</p>
                </div>
            </div>
            {result.tips.length > 0 && (
                <ul className="mt-5 flex flex-wrap gap-2">
                    {result.tips.map((t) => (
                        <li key={t} className="rounded-full bg-brand-soft px-3.5 py-1.5 text-[13px] font-bold text-brand-ink">{t}</li>
                    ))}
                </ul>
            )}
        </section>
    )
}
