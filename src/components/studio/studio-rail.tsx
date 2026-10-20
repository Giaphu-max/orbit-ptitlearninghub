import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Sparkles } from 'lucide-react'
import { getConcept, lessons } from '@/data'
import { studioBriefsWithConcept, type StudioBrief } from '@/lib/studio-briefs'
import { type CameraSetup } from '@/lib/studio-setup'

export type RailTab = 'camera' | 'light' | 'brief'

const TABS: { id: RailTab; label: string }[] = [
    { id: 'camera', label: 'Máy ảnh' },
    { id: 'light', label: 'Ánh sáng' },
    { id: 'brief', label: 'Đề bài' },
]

/** Preset ánh sáng chân dung kinh điển: đặt sẵn đèn chính, góc, đèn phụ, đèn viền (màu và nền giữ nguyên). */
const PRESETS = [
    { name: 'Rembrandt', key: 75, keyAngleDeg: -45, fill: 20, rim: 0, keyElevationDeg: 45 },
    { name: 'Butterfly', key: 80, keyAngleDeg: 0, fill: 35, rim: 0, keyElevationDeg: 60 },
    { name: 'Split', key: 80, keyAngleDeg: -90, fill: 0, rim: 0, keyElevationDeg: 10 },
    { name: 'Rim', key: 35, keyAngleDeg: -30, fill: 15, rim: 90, keyElevationDeg: 30 },
] as const

const BRIEF_GROUPS: { title: string; ids: string[] }[] = [
    { title: 'Ánh sáng', ids: ['key-light', 'fill-light', 'back-light', 'practical-light'] },
    { title: 'Màu sắc', ids: ['cac-thuat-ngu-mau-sac', 'tam-ly-hoc-mau-sac', 'phoi-hop-mau-sac'] },
    { title: 'Ngôn ngữ hình ảnh', ids: ['ngon-ngu-thi-giac-dien-anh'] },
]

interface Props {
    tab: RailTab
    onTab: (t: RailTab) => void
    setup: CameraSetup
    onSetup: (updater: (s: CameraSetup) => CameraSetup) => void
    brief: StudioBrief | undefined
    onPickConcept: (id: string) => void
    envLoading: boolean
    onApplyLighting: (text: string) => void
    explanation: string | null
}

/** Cột phải: ba tab Máy ảnh / Ánh sáng / Đề bài, nội dung cuộn trong cột. */
export function StudioRail({ tab, onTab, setup, onSetup, brief, onPickConcept, envLoading, onApplyLighting, explanation }: Props) {
    const [advanced, setAdvanced] = useState(false)
    const set = <K extends keyof CameraSetup>(key: K) => (value: number) => onSetup((s) => ({ ...s, [key]: value }))
    const briefConcept = brief ? getConcept(brief.conceptId) : undefined
    const briefs = studioBriefsWithConcept()

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
                        <Slider label="Đèn chính" unit="%" min={0} max={100} step={1} value={setup.key} onChange={set('key')} />
                        <Slider label="Góc đèn chính" unit="°" min={-90} max={90} step={1} value={setup.keyAngleDeg} onChange={set('keyAngleDeg')} />
                        <Slider label="Đèn phụ (làm dịu bóng)" unit="%" min={0} max={100} step={1} value={setup.fill} onChange={set('fill')} />
                        <Slider label="Đèn viền (tách khỏi phông)" unit="%" min={0} max={100} step={1} value={setup.rim} onChange={set('rim')} />
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
                    <div className="flex flex-col gap-4">
                        {brief && briefConcept ? (
                            <div className="rounded-card border border-brand-100 bg-brand-50 px-4 py-3">
                                <p className="text-eyebrow uppercase text-brand-ink">{briefConcept.name}</p>
                                <p className="mt-1.5 text-sm leading-relaxed text-foreground">{brief.task}</p>
                                <button
                                    type="button"
                                    disabled={envLoading}
                                    onClick={() => onApplyLighting(brief.lighting)}
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
                        ) : (
                            <p className="text-[13px] leading-relaxed text-muted-foreground">Chọn một khái niệm của khóa Nhiếp ảnh và ánh sáng để nhận đề bài và gợi ý ánh sáng.</p>
                        )}
                        {BRIEF_GROUPS.map((g) => {
                            const items = g.ids.flatMap((id) => briefs.filter((b) => b.conceptId === id))
                            if (items.length === 0) return null
                            return (
                                <Group key={g.title} title={g.title}>
                                    <ul className="flex flex-wrap gap-1.5" aria-label={`Khái niệm ${g.title}`}>
                                        {items.map((b) => (
                                            <li key={b.conceptId}>
                                                <Chip on={brief?.conceptId === b.conceptId} onClick={() => onPickConcept(b.conceptId)}>
                                                    {b.conceptName}
                                                </Chip>
                                            </li>
                                        ))}
                                    </ul>
                                </Group>
                            )
                        })}
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
