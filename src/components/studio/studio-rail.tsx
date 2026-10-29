import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Sparkles } from 'lucide-react'
import { getConcept, lessons } from '@/data'
import type { StudioBrief } from '@/data/types'
import type { StudioHint } from '@/lib/studio-hints'
import { intentHint } from '@/lib/studio-hints'
import { type CameraSetup } from '@/lib/studio-setup'

export type RailTab = 'camera' | 'light' | 'brief'

const TABS: { id: RailTab; label: string }[] = [
    { id: 'brief', label: 'Đề bài' },
    { id: 'camera', label: 'Máy ảnh' },
    { id: 'light', label: 'Ánh sáng' },
]

/** Preset ánh sáng chân dung kinh điển: đặt sẵn đèn chính, góc, đèn phụ, đèn viền (màu và nền giữ nguyên). */
const PRESETS = [
    { name: 'Rembrandt', key: 75, keyAngleDeg: -45, fill: 20, rim: 0, keyElevationDeg: 45 },
    { name: 'Butterfly', key: 80, keyAngleDeg: 0, fill: 35, rim: 0, keyElevationDeg: 60 },
    { name: 'Split', key: 80, keyAngleDeg: -90, fill: 0, rim: 0, keyElevationDeg: 10 },
    { name: 'Rim', key: 35, keyAngleDeg: -30, fill: 15, rim: 90, keyElevationDeg: 30 },
] as const

const LEVEL_LABEL = { unclear: 'Chưa rõ', near: 'Gần đạt', good: 'Tốt' } as const
const LEVEL_DOT = { unclear: 'bg-muted-foreground/40', near: 'bg-mm-orange', good: 'bg-success' } as const

interface Props {
    tab: RailTab
    onTab: (t: RailTab) => void
    setup: CameraSetup
    onSetup: (updater: (s: CameraSetup) => CameraSetup) => void
    brief: StudioBrief
    hints: { composition: StudioHint; lighting: StudioHint }
    envLoading: boolean
    onApplyLighting: (text: string) => void
    explanation: string | null
}

/** Cột phải: ba tab Đề bài / Máy ảnh / Ánh sáng, nội dung cuộn trong cột. */
export function StudioRail({ tab, onTab, setup, onSetup, brief, hints, envLoading, onApplyLighting, explanation }: Props) {
    const [advanced, setAdvanced] = useState(false)
    const set = <K extends keyof CameraSetup>(key: K) => (value: number) => onSetup((s) => ({ ...s, [key]: value }))
    const hintFor = (key: string): StudioHint | null => (key === 'composition' ? hints.composition : key === 'lighting' ? hints.lighting : key === 'intent' ? intentHint() : null)
    const sourceConcept = getConcept(brief.conceptIds[0])
    const sourceLesson = lessons.find((l) => l.concepts.some((c) => brief.conceptIds.includes(c.id)))

    return (
        <aside className="flex h-full min-h-[420px] min-w-0 flex-col overflow-hidden rounded-panel border border-border bg-card shadow-card min-[980px]:min-h-0">
            <div role="tablist" aria-label="Bảng điều khiển studio" className="m-3 flex gap-1 rounded-card bg-muted p-1.5">
                {TABS.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        role="tab"
                        id={`rail-tab-${t.id}`}
                        aria-selected={tab === t.id}
                        aria-controls={`rail-pane-${t.id}`}
                        onClick={() => onTab(t.id)}
                        className={`flex-1 rounded-lg px-2 py-2 text-[13px] font-bold transition duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
                            tab === t.id ? 'bg-card text-foreground shadow-card' : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            <div role="tabpanel" id={`rail-pane-${tab}`} aria-labelledby={`rail-tab-${tab}`} className="min-h-0 flex-1 overflow-y-auto px-[18px] pb-5 pt-1">
                {tab === 'camera' && (
                    <div className="flex flex-col gap-4">
                        <Slider label="Tiêu cự" unit="mm" min={24} max={135} step={1} value={setup.focalLengthMm} onChange={set('focalLengthMm')} />
                        <Slider label="Xoay quanh chủ thể" unit="°" min={-80} max={80} step={1} value={setup.azimuthDeg} onChange={set('azimuthDeg')} />
                        <Slider label="Độ cao máy" unit="°" min={-5} max={40} step={1} value={setup.elevationDeg} onChange={set('elevationDeg')} />
                        <button
                            type="button"
                            aria-expanded={advanced}
                            onClick={() => setAdvanced((a) => !a)}
                            className="inline-flex items-center gap-1.5 self-start text-[13px] font-bold text-brand-ink hover:underline"
                        >
                            <ChevronDown size={15} className={`transition-transform duration-fast ${advanced ? 'rotate-180' : ''}`} aria-hidden /> Nâng cao: khoảng cách, dịch khung
                        </button>
                        {advanced && (
                            <div className="flex flex-col gap-4">
                                <Slider label="Khoảng cách" unit="m" min={3} max={10} step={0.1} value={setup.distance} onChange={set('distance')} />
                                <Slider label="Dịch khung ngang" min={-0.4} max={0.4} step={0.01} value={setup.shiftX} onChange={set('shiftX')} format={(v) => `${Math.round(v * 100)}%`} />
                                <Slider label="Dịch khung dọc" min={-0.4} max={0.4} step={0.01} value={setup.shiftY} onChange={set('shiftY')} format={(v) => `${Math.round(v * 100)}%`} />
                            </div>
                        )}
                        <p className="text-[13px] leading-relaxed text-muted-foreground">Mẹo: tiêu cự dài làm nền gần chủ thể hơn, tiêu cự ngắn mở rộng không gian xung quanh.</p>
                    </div>
                )}

                {tab === 'light' && (
                    <div className="flex flex-col gap-4">
                        <Group title="Preset nhanh">
                            <ul className="flex flex-wrap gap-1.5" aria-label="Preset ánh sáng">
                                {PRESETS.map((p) => {
                                    const on = setup.key === p.key && setup.keyAngleDeg === p.keyAngleDeg && setup.fill === p.fill && setup.rim === p.rim
                                    return (
                                        <li key={p.name}>
                                            <Chip
                                                on={on}
                                                onClick={() =>
                                                    onSetup((s) => ({ ...s, key: p.key, keyAngleDeg: p.keyAngleDeg, fill: p.fill, rim: p.rim, look: { ...s.look, keyElevationDeg: p.keyElevationDeg } }))
                                                }
                                            >
                                                {p.name}
                                            </Chip>
                                        </li>
                                    )
                                })}
                            </ul>
                        </Group>
                        <Slider
                            label={
                                <span className="flex items-center gap-2 font-medium text-foreground">
                                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-mm-orange" aria-hidden />
                                    <span>Đèn chính (Key Light)</span>
                                </span>
                            }
                            unit="%"
                            min={0}
                            max={100}
                            step={1}
                            value={setup.key}
                            onChange={set('key')}
                        />
                        <Slider
                            label={
                                <span className="flex items-center gap-2 font-medium text-foreground">
                                    <span className="h-2 w-2 shrink-0 rounded-full bg-mm-yellow" aria-hidden />
                                    <span>Góc đèn chính</span>
                                </span>
                            }
                            unit="°"
                            min={-90}
                            max={90}
                            step={1}
                            value={setup.keyAngleDeg}
                            onChange={set('keyAngleDeg')}
                        />
                        <Slider
                            label={
                                <span className="flex items-center gap-2 font-medium text-foreground">
                                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-mm-sky" aria-hidden />
                                    <span>Đèn phụ (Fill Light)</span>
                                </span>
                            }
                            unit="%"
                            min={0}
                            max={100}
                            step={1}
                            value={setup.fill}
                            onChange={set('fill')}
                        />
                        <Slider
                            label={
                                <span className="flex items-center gap-2 font-medium text-foreground">
                                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-mm-pink" aria-hidden />
                                    <span>Đèn viền (Rim Light)</span>
                                </span>
                            }
                            unit="%"
                            min={0}
                            max={100}
                            step={1}
                            value={setup.rim}
                            onChange={set('rim')}
                        />
                        {explanation ? (
                            <div role="status" className="rounded-card border border-brand-100 bg-brand-50 px-4 py-3">
                                <p className="text-eyebrow uppercase text-brand-ink">Vì sao AI chọn vậy</p>
                                <p className="mt-1.5 text-sm leading-relaxed text-foreground">{explanation}</p>
                            </div>
                        ) : (
                            <p className="text-[13px] leading-relaxed text-muted-foreground">Hoặc gõ mô tả trong thanh AI ngay trên khung hình, AI sẽ đặt đèn giúp bạn.</p>
                        )}
                    </div>
                )}

                {tab === 'brief' && (
                    <div className="flex min-h-full flex-col gap-4">
                        <div>
                            <h3 className="text-[14px] font-extrabold text-strong">
                                Tiêu chí chấm · <span className="font-mono">{brief.rubric.reduce((n, r) => n + r.points, 0)}</span> điểm · đạt từ <span className="font-mono">{brief.passScore}</span>
                            </h3>
                            <p className="mt-1 text-xs text-muted-foreground">Chấm dưới đây là gợi ý theo cảnh hiện tại, không phải điểm.</p>
                        </div>
                        <ul className="flex flex-col gap-3">
                            {brief.rubric.map((r) => {
                                const hint = hintFor(r.key)
                                return (
                                    <li key={r.key} className="rounded-card border border-border bg-card px-4 py-3">
                                        <div className="flex items-baseline justify-between gap-3">
                                            <b className="text-[14.5px] font-extrabold text-strong">{r.label}</b>
                                            <span className="font-mono text-sm font-bold text-strong">{r.points}đ</span>
                                        </div>
                                        <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">{r.description}</p>
                                        {hint && (
                                            <p className="mt-2 flex items-start gap-2 text-[13px] leading-snug text-foreground">
                                                <span
                                                    role="img"
                                                    aria-label={LEVEL_LABEL[hint.level]}
                                                    title={LEVEL_LABEL[hint.level]}
                                                    className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${LEVEL_DOT[hint.level]}`}
                                                />
                                                <span>
                                                    <b className="font-bold">{LEVEL_LABEL[hint.level]}.</b> {hint.text}
                                                </span>
                                            </p>
                                        )}
                                        <p className="mt-1.5 text-xs leading-snug text-muted-foreground">Một cách đạt: {r.hint}</p>
                                    </li>
                                )
                            })}
                        </ul>
                        <div className="rounded-card bg-muted px-4 py-3">
                            <p className="text-[13.5px] font-extrabold text-strong">Tự do sáng tạo</p>
                            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                                Không bắt buộc thông số đèn hay tiêu cự. AI chấm theo hiệu quả của bức ảnh — có cách khác đạt cùng cảm giác vẫn được điểm, làm khác mà hiệu quả được thêm tối đa +10 điểm sáng tạo.
                            </p>
                        </div>
                        <div className="mt-auto flex flex-col items-start gap-2 pt-1">
                            <button
                                type="button"
                                disabled={envLoading}
                                onClick={() => onApplyLighting(brief.goal)}
                                className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-[13px] font-bold text-ink-foreground transition hover:bg-brand-700 disabled:opacity-50"
                            >
                                <Sparkles size={14} /> Gợi ý một cách dựng sáng
                            </button>
                            {sourceLesson && sourceConcept && (
                                <Link to={`/lesson/${sourceLesson.id}?t=${Math.floor(sourceConcept.segment.start)}`} className="text-xs font-semibold text-brand-ink hover:underline">
                                    Xem lại đoạn giảng
                                </Link>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </aside>
    )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div>
            <h3 className="mb-2 mt-1 text-eyebrow uppercase text-muted-foreground">{title}</h3>
            {children}
        </div>
    )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            type="button"
            aria-pressed={on}
            onClick={onClick}
            className={`rounded-full border px-3 py-1.5 text-left text-[12px] font-semibold transition duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
                on ? 'border-brand-600 bg-brand-50 text-brand-ink' : 'border-border bg-card text-foreground hover:border-brand-300'
            }`}
        >
            {children}
        </button>
    )
}

interface SliderProps {
    label: React.ReactNode
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
            <span className="flex items-center justify-between text-[13px] text-muted-foreground">
                <span className="min-w-0">{label}</span>
                <span className="font-mono font-bold text-foreground">{format ? format(value) : `${step < 1 ? value.toFixed(1) : value}${unit}`}</span>
            </span>
            <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1.5 w-full accent-brand-600" />
        </label>
    )
}
