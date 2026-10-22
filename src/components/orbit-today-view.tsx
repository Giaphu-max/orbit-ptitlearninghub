import { Link } from 'react-router-dom'
import { ArrowRight, Check, Moon } from 'lucide-react'
import { getConcept } from '@/data'
import { MissionList } from '@/components/missions'
import { useTodayDaily } from '@/hooks/useTodayDaily'
import { DAILY_ARTICLE_XP } from '@/lib/gamification'

/** /today – 3 bài Orbit Daily hôm nay (có giới hạn), nhiệm vụ hằng ngày, và màn "Hôm nay đủ rồi" khi đọc đủ. */
export function OrbitTodayView() {
    const { articles, read, readCount, priority, allDone, noteFor, limit } = useTodayDaily()
        // Thẻ to dành cho bài ưu tiên; hết bài chưa đọc thì bài đầu danh sách
    const hero = priority ?? articles[0]
    const others = articles.filter((a) => a.id !== hero?.id)

    return (
        <div className="w-full">
            <div className="mx-auto flex max-w-5xl flex-col gap-12 px-5 py-8 lg:px-8 lg:py-12">
                <header>
                    <p className="text-eyebrow uppercase text-brand-ink">Orbit Daily · {readCount}/{limit} bài</p>
                    <h1 className="mt-3 text-headline text-foreground">Hôm nay</h1>
                    <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
                        {limit} bài đọc ngắn, AI chọn theo phần bạn còn hổng. Mỗi bài kết thúc bằng một câu kiểm tra; trả lời đúng mới tính là đã đọc. Đọc xong thì nghỉ.
                    </p>
                </header>

                {allDone ? <DoneBlock /> : null}

                {hero && (
                    <section aria-label="Bài đọc hôm nay" className="grid gap-4 md:grid-cols-2">
                        <Link
                            to={`/daily/${hero.id}`}
                            data-vt={`daily-${hero.id}`}
                            className={`group flex min-h-[260px] flex-col justify-between rounded-card p-7 shadow-card transition duration-base ease-out hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 md:row-span-2 ${read[hero.id] ? 'bg-card text-foreground opacity-70' : 'bg-brand-600 text-ink-foreground'}`}
                        >
                            <span className="font-mono text-xs font-bold uppercase tracking-[0.14em] opacity-80">{noteFor(hero)}</span>
                            <span>
                                <b className="block text-[clamp(1.4rem,2.4vw,1.9rem)] font-extrabold leading-tight tracking-[-0.02em]">{hero.title}</b>
                                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-extrabold">
                                    {read[hero.id] ? 'Đọc lại' : 'Đọc'} <ArrowRight size={15} className="transition group-hover:translate-x-0.5" />
                                </span>
                            </span>
                        </Link>
                        {others.map((a) => {
                            const done = Boolean(read[a.id])
                            return (
                                <Link
                                    key={a.id}
                                    to={`/daily/${a.id}`}
                                    data-vt={`daily-${a.id}`}
                                    className={`group flex items-center gap-4 rounded-card border border-border bg-card p-5 shadow-card transition duration-base ease-out hover:-translate-y-0.5 hover:border-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 ${done ? 'opacity-70' : ''}`}
                                >
                                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${done ? 'bg-brand-600 text-ink-foreground' : 'bg-muted font-mono text-xs'}`}>
                                        {done ? <Check size={18} /> : String(articles.indexOf(a) + 1).padStart(2, '0')}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <b className="block text-[15px] leading-snug">{a.title}</b>
                                        <small className="mt-0.5 block text-xs text-muted-foreground">{noteFor(a)}</small>
                                    </span>
                                    <span className="inline-flex items-center gap-1 text-xs font-extrabold text-brand-ink">
                                        {done ? 'Đọc lại' : 'Đọc'} <ArrowRight size={13} />
                                    </span>
                                </Link>
                            )
                        })}
                    </section>
                )}
                {articles.length === 0 && <p className="rounded-card bg-muted p-5 text-muted-foreground">Chưa có bài Orbit Daily nào.</p>}

                <section>
                    <h2 className="text-title text-foreground">Nhiệm vụ hôm nay</h2>
                    <MissionList />
                </section>
            </div>
        </div>
    )
}

/** "Hôm nay đủ rồi": tóm tắt những gì đã học qua các bài vừa đọc (khái niệm, XP). */
function DoneBlock() {
    const { articles, read } = useTodayDaily()
    const done = articles.filter((a) => read[a.id])
    const conceptIds = [...new Set(done.flatMap((a) => a.conceptIds))]
    return (
        <section aria-label="Hôm nay đủ rồi" className="rounded-card bg-brand-soft p-7">
            <p className="flex items-center gap-2 text-eyebrow uppercase text-brand-ink">
                <Moon size={14} /> Đủ lượt hôm nay
            </p>
            <h2 className="mt-3 text-[clamp(1.6rem,3vw,2.2rem)] font-extrabold leading-tight tracking-[-0.03em] text-foreground">Hôm nay đủ rồi. Hẹn bạn ngày mai.</h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
                Bạn đã đọc {done.length} bài (+{done.length * DAILY_ARTICLE_XP} XP). Để kiến thức ngấm, hãy nghỉ; có thể mở thêm bài bằng cách hoàn thành nhiệm vụ học tập.
            </p>
            <ul className="mt-5 flex flex-col gap-2">
                {done.map((a) => (
                    <li key={a.id} className="flex items-start gap-2.5 text-sm text-foreground">
                        <Check size={16} className="mt-0.5 shrink-0 text-brand-ink" />
                        <span>
                            <b>{a.title}</b>
                            <span className="text-muted-foreground"> · {a.conceptIds.map((id) => getConcept(id)?.name ?? id).join(', ')}</span>
                        </span>
                    </li>
                ))}
            </ul>
            {conceptIds.length > 0 && <p className="mt-4 text-xs text-muted-foreground">Khái niệm đã ôn hôm nay: {conceptIds.length}</p>}
        </section>
    )
}
