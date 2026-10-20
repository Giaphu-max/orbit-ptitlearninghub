import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Check, ChevronLeft, Clock, X } from 'lucide-react'
import { dailyArticles, getConcept, getLesson } from '@/data'
import { announceRewards, DAILY_ARTICLE_XP, DAILY_CHECK_XP } from '@/lib/gamification'
import { lessonShortTitle } from '@/lib/utils'
import { formatTime } from '@/lib/youtube'
import { useOrbitStore } from '@/store/useOrbitStore'

/** /daily/:id – bài đọc ngắn có dẫn nguồn về bài giảng; trả lời đúng câu kiểm tra mới tính hoàn thành. */
export function OrbitDailyView() {
    const { articleId } = useParams()
    const article = dailyArticles.find((a) => a.id === articleId)
    const read = useOrbitStore((s) => (article ? s.dailyRead[article.id] : undefined))
    const complete = useOrbitStore((s) => s.completeDailyArticle)
    const [chosen, setChosen] = useState<Record<string, number>>({})

    if (!article) return <Navigate to="/" replace />

    const allCorrect = article.checks.every((c) => chosen[c.id] === c.correctIndex)

    const finish = () => {
        const before = useOrbitStore.getState()
        if (complete(article.id, DAILY_ARTICLE_XP) === 0) return
        const after = useOrbitStore.getState()
        announceRewards(
            before,
            after,
            {
                context: `Hoàn thành · ${article.title}`,
                headline: 'Thêm một mảnh ghép.',
                rows: [
                    { label: 'Đọc xong bài', xp: DAILY_ARTICLE_XP - DAILY_CHECK_XP },
                    { label: 'Trả lời đúng câu kiểm tra', xp: DAILY_CHECK_XP },
                ],
                next: { label: 'Học tiếp', to: '/#daily' },
            },
        )
    }

    return (
        <div className="w-full">
            <article className="mx-auto max-w-2xl px-5 py-8 lg:py-12">
                <Link to="/#daily" className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-semibold text-muted-foreground transition hover:bg-card hover:text-foreground">
                    <ChevronLeft size={16} /> Orbit Daily
                </Link>
                <p className="mt-6 flex items-center gap-2 text-eyebrow uppercase text-brand-ink">
                    <Clock size={13} /> {article.readingMinutes} phút đọc · +{DAILY_ARTICLE_XP} XP
                </p>
                <h1 className="mt-3 text-headline text-foreground">{article.title}</h1>

                <div className="mt-8 flex flex-col gap-6">
                    {article.paragraphs.map((p, i) => (
                        <div key={i}>
                            <p className="text-[17px] leading-relaxed text-foreground">{p.text}</p>
                            <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                Nguồn:
                                {p.sources.map((src) => {
                                    const lesson = getLesson(src.lessonId)
                                    const full = lesson?.title ?? src.lessonId
                                    return (
                                        <Link
                                            key={`${src.lessonId}-${src.start}`}
                                            to={`/lesson/${src.lessonId}?t=${src.start}`}
                                            title={`${full} · ${formatTime(src.start)}`}
                                            aria-label={`${full}, mốc ${formatTime(src.start)}`}
                                            className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 font-semibold text-foreground transition hover:border-brand-300"
                                        >
                                            <span className="truncate">{lesson ? lessonShortTitle(lesson) : src.lessonId}</span>
                                            <span className="shrink-0 font-mono text-brand-ink">{formatTime(src.start)}</span>
                                        </Link>
                                    )
                                })}
                            </p>
                        </div>
                    ))}
                </div>

                <section className="mt-10 rounded-panel border border-border bg-card p-6 shadow-card" aria-label="Kiểm tra nhanh">
                    <p className="text-eyebrow uppercase text-brand-ink">Kiểm tra nhanh</p>
                    {article.checks.map((c) => {
                        const pick = chosen[c.id]
                        const answered = pick !== undefined
                        return (
                            <div key={c.id} className="mt-3">
                                <p className="font-bold text-foreground">{c.prompt}</p>
                                <ul className="mt-3 flex flex-col gap-2">
                                    {c.options.map((opt, i) => {
                                        const correct = answered && i === c.correctIndex
                                        const wrong = answered && i === pick && !correct
                                        return (
                                            <li key={i}>
                                                <button
                                                    type="button"
                                                    disabled={read !== undefined || (answered && pick === c.correctIndex)}
                                                    onClick={() => setChosen((m) => ({ ...m, [c.id]: i }))}
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
                                {answered && <p className="mt-3 text-sm text-muted-foreground">{pick === c.correctIndex ? c.explanation : 'Chưa đúng, thử lại nhé. Gợi ý: đọc lại đoạn có nguồn phía trên.'}</p>}
                            </div>
                        )
                    })}
                    <div className="mt-6 flex flex-wrap items-center gap-3">
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
                        <span className="text-xs text-muted-foreground">
                            Khái niệm: {article.conceptIds.map((id) => getConcept(id)?.name ?? id).join(', ')}
                        </span>
                    </div>
                </section>
            </article>
        </div>
    )
}
