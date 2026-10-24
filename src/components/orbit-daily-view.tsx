import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Check, ChevronLeft, Clock, X } from 'lucide-react'
import { dailyArticles, getConcept } from '@/data'
import type { DailyBlock } from '@/data/types'
import { ConceptPopover, type OpenConcept } from '@/components/daily/concept-popover'
import { InlineText } from '@/components/daily/inline-text'
import { SourceChip } from '@/components/daily/source-chip'
import { checkBlocks } from '@/lib/daily-text'
import { celebrate, reactWrong } from '@/lib/feedback'
import { nextDaily } from '@/lib/next-step'
import { announceRewards, DAILY_ARTICLE_XP, DAILY_CHECK_XP } from '@/lib/gamification'
import { useOrbitStore } from '@/store/useOrbitStore'

/** /daily/:id – bài đọc ngắn có dẫn nguồn về bài giảng; trả lời đúng câu kiểm tra mới tính hoàn thành. */
export function OrbitDailyView() {
    const { articleId } = useParams()
    const article = dailyArticles.find((a) => a.id === articleId)
    const read = useOrbitStore((s) => (article ? s.dailyRead[article.id] : undefined))
    const complete = useOrbitStore((s) => s.completeDailyArticle)
    const [chosen, setChosen] = useState<Record<string, number>>({})
    const [concept, setConcept] = useState<OpenConcept | null>(null)
    const hadWrong = useRef(false)
    const barRef = useRef<HTMLDivElement>(null)
    const articleRef = useRef<HTMLElement>(null)
    const closeConcept = useCallback(() => setConcept(null), [])
    const openConcept = useCallback((id: string, anchor: HTMLElement) => setConcept((c) => (c?.id === id && c.anchor === anchor ? null : { id, anchor })), [])

    // Đọc tập trung: khối active là khối có tâm gần dòng đọc (42% chiều cao màn hình) nhất; chỉ đổi khi khối mới gần hơn ít nhất 24px.
    // Một listener scroll passive + rAF; trạng thái ghi thẳng vào data-active của khung (không qua React).
    useEffect(() => {
        const root = articleRef.current
        if (!root) return
        const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        const frames = [...root.querySelectorAll<HTMLElement>('[data-focus]')]
        const HYSTERESIS = 24
        let active = -1
        let raf = 0
        const line = () => window.innerHeight * 0.42
        const dist = (el: HTMLElement) => {
            const r = el.getBoundingClientRect()
            return Math.abs(r.top + r.height / 2 - line())
        }
        const update = () => {
            raf = 0
            const d = frames.map(dist)
            // Vừa mở bài (chưa cuộn): luôn sáng khối mở đầu
            const best = window.scrollY < 40 ? 0 : d.indexOf(Math.min(...d))
            const switchNow = active < 0 || (best !== active && (window.scrollY < 40 || d[active] - d[best] >= HYSTERESIS))
            if (switchNow) {
                active = best
                frames.forEach((f, i) => f.setAttribute('data-active', String(i === active)))
            }
            if (barRef.current) barRef.current.style.transform = `scaleX(${frames.length > 1 ? active / (frames.length - 1) : 1})`
        }
        const schedule = () => {
            if (!raf) raf = requestAnimationFrame(update)
        }
        const scrollTo = (i: number) => {
            const f = frames[Math.max(0, Math.min(frames.length - 1, i))]
            const r = f.getBoundingClientRect()
            window.scrollTo({ top: window.scrollY + r.top + r.height / 2 - line(), behavior: calm ? 'auto' : 'smooth' })
        }
        const onKey = (e: KeyboardEvent) => {
            if (!['ArrowDown', 'ArrowUp', 'j', 'k'].includes(e.key) || e.metaKey || e.ctrlKey || e.altKey) return
            if (e.target instanceof Element && e.target.closest('button, a, input, textarea, [role=dialog]')) return
            scrollTo(active + (e.key === 'ArrowDown' || e.key === 'j' ? 1 : -1))
            e.preventDefault()
        }
        const onClick = (e: MouseEvent) => {
            if (e.target instanceof Element && e.target.closest('button, a')) return
            const i = frames.findIndex((f) => f.contains(e.target as Node))
            if (i >= 0 && i !== active) scrollTo(i)
        }
        update()
        window.addEventListener('scroll', schedule, { passive: true })
        window.addEventListener('resize', schedule)
        window.addEventListener('keydown', onKey)
        root.addEventListener('click', onClick)
        return () => {
            window.removeEventListener('scroll', schedule)
            window.removeEventListener('resize', schedule)
            window.removeEventListener('keydown', onKey)
            root.removeEventListener('click', onClick)
            if (raf) cancelAnimationFrame(raf)
        }
    }, [article?.id])

    if (!article) return <Navigate to="/" replace />

    const checks = checkBlocks(article)
    const allCorrect = checks.every((c) => chosen[c.question.id] === c.question.correctIndex)

    // Trả lời câu kiểm tra: đúng thì phản hồi ngay (không có XP riêng, XP tính khi hoàn thành bài), sai thì ngắt combo
    const pick = (q: (typeof checks)[number]['question'], n: number, el: HTMLElement) => {
        const fixed = chosen[q.id] !== undefined && chosen[q.id] !== q.correctIndex
        setChosen((m) => ({ ...m, [q.id]: n }))
        if (n === q.correctIndex) celebrate({ anchor: el, kind: fixed ? 'corrected' : 'correct' })
        else {
            hadWrong.current = true
            reactWrong(el)
        }
    }

    const finish = () => {
        const before = useOrbitStore.getState()
        if (complete(article.id, DAILY_ARTICLE_XP) === 0) return
        const after = useOrbitStore.getState()
        const upcoming = nextDaily()
        const nextStep = upcoming ? { label: 'Bài đọc kế tiếp', to: `/daily/${upcoming.id}` } : { label: 'Xem tóm tắt hôm nay', to: '/today' }
        announceRewards(
            before,
            after,
            {
                context: `Hoàn thành · ${article.title}`,
                headline: hadWrong.current ? 'Sai một lần, hiểu tận gốc.' : 'Thêm một mảnh ghép.',
                rows: [
                    { label: 'Đọc xong bài', xp: DAILY_ARTICLE_XP - DAILY_CHECK_XP },
                    { label: 'Trả lời đúng câu kiểm tra', xp: DAILY_CHECK_XP },
                ],
                next: nextStep,
            },
            // Một hành động chính: bài Daily kế; hết lượt thì về màn "Hôm nay đủ rồi"
            { source: 'daily', next: nextStep },
        )
    }

    return (
        <div className="w-full overflow-x-clip">
            <div aria-hidden className="fixed inset-x-0 top-[var(--nav-h)] z-40 h-[3px] bg-border">
                <div ref={barRef} className="h-full origin-left bg-brand-600" style={{ transform: 'scaleX(0)' }} />
            </div>
            <article ref={articleRef} className="mx-auto max-w-[720px] px-5 pb-[40vh] pt-8 lg:pt-12">
                <Link to="/today" className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-semibold text-muted-foreground transition hover:bg-card hover:text-foreground">
                    <ChevronLeft size={16} /> Bài đọc hôm nay
                </Link>
                {/* Header bài đọc: nơi thẻ Orbit Daily ở trang chủ morph tới (cùng view-transition-name) */}
                <div style={{ viewTransitionName: `vt-daily-${article.id}` }} className="mt-6">
                    <p className="flex items-center gap-2 text-eyebrow uppercase text-brand-ink">
                        <Clock size={13} /> {article.readingMinutes} phút đọc · +{DAILY_ARTICLE_XP} XP
                    </p>
                    <h1 className="mt-3 text-headline text-foreground">{article.title}</h1>
                </div>

                <div className="mt-10 flex flex-col gap-10 sm:gap-12">
                    {article.blocks.map((block, i) => (
                        <div key={i} data-block={block.type}>
                            <div data-focus className={`fb ${FRAME[block.type]}`}>
                                {CARD_TYPES.has(block.type) && <span aria-hidden className="fb-bar" />}
                                {block.type === 'check' ? (
                                    <CheckBlock
                                        block={block}
                                        pick={chosen[block.question.id]}
                                        locked={read !== undefined}
                                        onPick={(n, el) => pick(block.question, n, el)}
                                    />
                                ) : (
                                    <>
                                        <BlockBody block={block} onConcept={openConcept} />
                                        <SourceChip sources={block.sources} />
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-10 flex flex-wrap items-center gap-3 rounded-panel border border-border bg-card p-6 shadow-card">
                    {read ? (
                        <span className="inline-flex items-center gap-2 text-sm font-bold text-success">
                            <Check size={16} /> Đã hoàn thành, +{DAILY_ARTICLE_XP} XP đã nhận
                        </span>
                    ) : (
                        <button
                            type="button"
                            disabled={!allCorrect}
                            onClick={finish}
                            className="rounded-full bg-brand-600 px-6 py-3 text-sm font-bold text-ink-foreground shadow-brand transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
                        >
                            Hoàn thành bài đọc
                        </button>
                    )}
                    <span className="text-xs text-muted-foreground">Khái niệm: {article.conceptIds.map((id) => getConcept(id)?.name ?? id).join(', ')}</span>
                </div>
            </article>
            {concept && <ConceptPopover open={concept} onClose={closeConcept} />}
        </div>
    )
}

/** Loại khối nâng lên thành thẻ có thanh đỏ khi đang đọc (quote, điểm cốt lõi, câu kiểm tra có kiểu riêng). */
const CARD_TYPES = new Set<DailyBlock['type']>(['hook', 'paragraph', 'bullets', 'example'])
const FRAME: Record<DailyBlock['type'], string> = { hook: 'fb-card', paragraph: 'fb-card', bullets: 'fb-card', example: 'fb-card', quote: '', keypoint: '', check: '' }

type TextBlock = Exclude<DailyBlock, { type: 'check' }>

function BlockBody({ block, onConcept }: { block: TextBlock; onConcept: (id: string, el: HTMLElement) => void }) {
    switch (block.type) {
        case 'hook':
            return (
                <p className="text-[clamp(2rem,7vw,3.5rem)] font-extrabold leading-[1.08] tracking-tight text-foreground">
                    <InlineText text={block.text} onConcept={onConcept} />
                </p>
            )
        case 'paragraph':
            return (
                <p className="text-[clamp(19px,1.6vw,22px)] leading-[1.7] text-foreground">
                    <InlineText text={block.text} onConcept={onConcept} />
                </p>
            )
        case 'quote':
            return (
                <blockquote>
                    <p className="fb-qtext text-[clamp(1.5rem,4.6vw,2.125rem)] font-semibold italic leading-snug tracking-tight text-foreground">“{block.text}”</p>
                    <span aria-hidden className="fb-uline mt-4 block h-1 w-[120px] rounded-full bg-brand-600" />
                </blockquote>
            )
        case 'keypoint':
            return (
                <section className="fb-kp rounded-panel border border-border bg-card p-6 shadow-card sm:p-7">
                    <p className="text-eyebrow uppercase text-brand-ink">Điểm cốt lõi</p>
                    <p className="mt-3 text-xl font-bold leading-snug text-foreground">
                        <InlineText text={block.text} onConcept={onConcept} />
                    </p>
                </section>
            )
        case 'bullets':
            return (
                <ul className="flex flex-col gap-3">
                    {block.items.map((item, i) => (
                        <li key={i} className="flex gap-3 text-[clamp(19px,1.6vw,22px)] leading-[1.6] text-foreground">
                            <span aria-hidden className="mt-3 h-2 w-2 shrink-0 rounded-full bg-brand-600" />
                            <span>
                                <InlineText text={item} onConcept={onConcept} />
                            </span>
                        </li>
                    ))}
                </ul>
            )
        case 'example':
            return (
                <section>
                    <p className="text-eyebrow uppercase text-muted-foreground">Ví dụ áp dụng</p>
                    <p className="mt-3 text-[clamp(19px,1.6vw,22px)] leading-[1.7] text-foreground">
                        <InlineText text={block.text} onConcept={onConcept} />
                    </p>
                </section>
            )
    }
}

function CheckBlock({ block, pick, locked, onPick }: { block: Extract<DailyBlock, { type: 'check' }>; pick: number | undefined; locked: boolean; onPick: (i: number, el: HTMLElement) => void }) {
    const c = block.question
    const answered = pick !== undefined
    return (
        <section className="rounded-panel border border-border bg-card p-6 shadow-card" aria-label="Kiểm tra nhanh">
            <p className="text-eyebrow uppercase text-brand-ink">Kiểm tra nhanh</p>
            <p className="mt-3 font-bold text-foreground">{c.prompt}</p>
            <ul className="mt-3 flex flex-col gap-2">
                {c.options.map((opt, i) => {
                    const correct = answered && i === c.correctIndex && pick === c.correctIndex
                    const wrong = answered && i === pick && i !== c.correctIndex
                    return (
                        <li key={i}>
                            <button
                                type="button"
                                disabled={locked || (answered && pick === c.correctIndex)}
                                onClick={(e) => onPick(i, e.currentTarget)}
                                className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-[15px] transition duration-fast ${
                                    correct ? 'border-success bg-success/10 text-foreground' : wrong ? 'answer-wrong' : 'border-border bg-card text-foreground hover:border-brand-300'
                                }`}
                            >
                                {opt}
                                {correct && <Check size={16} className="text-success" />}
                                {wrong && <X size={16} className="text-brand-ink" />}
                            </button>
                        </li>
                    )
                })}
            </ul>
            {answered && <p className="mt-3 text-sm text-muted-foreground">{pick === c.correctIndex ? c.explanation : 'Chưa đúng, thử lại nhé. Gợi ý: mở “Nguồn” của các khối phía trên để xem lại đoạn giảng.'}</p>}
            <SourceChip sources={block.sources} />
        </section>
    )
}
