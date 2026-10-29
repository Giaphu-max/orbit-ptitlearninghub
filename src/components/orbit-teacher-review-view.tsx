import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowRight, Image as ImageIcon, Info, X, ChevronDown } from 'lucide-react'
import type { ClassStats, Lesson, LessonQuizQuestion } from '@/data/types'
import { useYouTubePlayer } from '@/hooks/useYouTubePlayer'
import { CoverEditor } from '@/components/courses/cover-editor'
import { StepPills, TitleBlock } from '@/components/lesson/lesson-header'
import { LessonPlayer } from '@/components/lesson/lesson-player'
import { PlayerControls } from '@/components/lesson/player-controls'
import { ItemActions, OptionRows, ReviewRow, VariantsBox, fieldCls, labelCls } from '@/components/teacher/review-fields'
import { TRAP_NOTES } from '@/data/teacher-notes'
import { ApiRequestError, rewriteContent } from '@/lib/api'
import { conceptRate, HOT_RATE, itemKey, lessonsOriginal, statsForCourse, useLessonReviews, useTeacherClass, validate, type LessonReview } from '@/lib/teacher'
import { formatTime } from '@/lib/youtube'
import { useOrbitStore, type LessonEdits } from '@/store/useOrbitStore'

type Tab = 'sum' | 'con' | 'q'
const TAB_ORDER: Tab[] = ['sum', 'con', 'q']
const NO_RESULTS = {}

const tabOf = (key: string): Tab => (key === 'sum' ? 'sum' : key.startsWith('c:') ? 'con' : 'q')

/** Khóa các mục của một tab theo thứ tự hiển thị: xếp theo % lớp sai lần đầu giảm dần. */
function orderedKeys(tab: Tab, d: Pick<LessonEdits, 'concepts' | 'quiz'>, stats: ClassStats): string[] {
    if (tab === 'sum') return ['sum']
    const rows =
        tab === 'con'
            ? d.concepts.map((c, i) => ({ key: itemKey.concept(c.id), i, rate: conceptRate(stats, c.id) ?? -1 }))
            : d.quiz.map((q, i) => ({ key: itemKey.question(q.id), i, rate: conceptRate(stats, q.conceptId) ?? -1 }))
    return rows.sort((a, b) => b.rate - a.rate || a.i - b.i).map((r) => r.key)
}

function timeOf(key: string, l: Pick<Lesson, 'concepts' | 'quiz'>): number {
    if (key.startsWith('c:')) return l.concepts.find((c) => c.id === key.slice(2))?.segment.start ?? 0
    if (key.startsWith('q:')) return l.quiz.find((q) => q.id === key.slice(2))?.pauseAt ?? 0
    return 0
}

const snap = (e: LessonEdits) => JSON.stringify({ summary: e.summary, concepts: e.concepts, quiz: e.quiz, transcript: e.transcript })

/** /teacher/review/:lessonId? – duyệt, sửa nội dung AI tạo cho một bài rồi xuất bản. Mặc định mở bài đang duyệt dở. */
export function OrbitTeacherReviewView() {
    const role = useOrbitStore((s) => s.role)
    const { lessonId } = useParams()
    const reviews = useLessonReviews()
    if (role !== 'teacher') return <Navigate to="/" replace />
    if (!lessonId) return <Navigate to="/teacher/library" replace />
    const review = reviews.find((r) => r.lesson.id === lessonId)
    // Bài chưa tạo xong hoặc không có: về thư viện bài giảng
    if (!review || review.state === 'generating') return <Navigate to="/teacher/library" replace />
    // key: đổi bài thì dựng lại trình phát và các trường sửa từ nội dung của bài đó
    return <ReviewPage key={review.lesson.id} review={review} reviews={reviews} />
}

function ReviewPage({ review, reviews }: { review: LessonReview; reviews: LessonReview[] }) {
    const { lesson, published, reviewed, total } = review
    const { cls } = useTeacherClass()
    const stats = statsForCourse(lesson.courseId, cls)
    const [searchParams] = useSearchParams()
    const savedEdits = useOrbitStore((s) => s.lessonEdits[lesson.id])
    const setReviewedItems = useOrbitStore((s) => s.setReviewedItems)
    const setLessonReview = useOrbitStore((s) => s.setLessonReview)
    const setLessonEdits = useOrbitStore((s) => s.setLessonEdits)

    const [draft, setDraft] = useState<LessonEdits>(() => ({ summary: lesson.summary, concepts: lesson.concepts, quiz: lesson.quiz }))
    const dirty = useMemo(() => snap(draft) !== snap({ summary: lesson.summary, concepts: lesson.concepts, quiz: lesson.quiz, transcript: savedEdits?.transcript }), [draft, lesson, savedEdits])
    const problems = useMemo(() => validate(draft), [draft])
    // Nội dung đang sửa: phụ đề và mốc trên video cập nhật ngay
    const live = useMemo<Lesson>(() => ({ ...lesson, summary: draft.summary, concepts: draft.concepts, quiz: draft.quiz, ...(draft.transcript ? { transcript: draft.transcript } : {}) }), [lesson, draft])

    // Tab và dòng mở ban đầu: ?item= (từ Tổng quan / Lớp học), không thì mục chưa duyệt đầu tiên (ưu tiên Câu hỏi)
    const [start] = useState(() => {
        const item = searchParams.get('item')
        const all = TAB_ORDER.flatMap((t) => orderedKeys(t, lesson, stats))
        if (item && all.includes(item)) return { tab: tabOf(item), open: item as string | null }
        for (const t of ['q', 'con', 'sum'] as Tab[]) {
            const first = orderedKeys(t, lesson, stats).find((k) => !reviewed.has(k))
            if (first) return { tab: t, open: first as string | null }
        }
        return { tab: 'q' as Tab, open: null }
    })
    const [tab, setTab] = useState<Tab>(start.tab)
    const [openKey, setOpenKey] = useState<string | null>(start.open)

    const player = useYouTubePlayer(lesson.youtubeId, { hideControls: true })
    const { seekTo } = player
    const canPlay = player.status === 'ready'
    const [captionsOn, setCaptionsOn] = useState(true)
    const playerAreaRef = useRef<HTMLDivElement>(null)

    // Vào trang với mục đã chọn (?item= hoặc ?t=): tua tới mốc khi trình phát sẵn sàng
    const seekedRef = useRef(false)
    useEffect(() => {
        if (seekedRef.current || !canPlay) return
        seekedRef.current = true
        const t = Number(searchParams.get('t'))
        if (Number.isFinite(t) && t > 0) seekTo(t, { play: false })
        else if (start.open) seekTo(timeOf(start.open, lesson), { play: false })
    }, [canPlay, searchParams, seekTo, start.open, lesson])

    const openItem = useCallback(
        (key: string) => {
            setOpenKey(key)
            seekTo(timeOf(key, live), { play: false })
        },
        [seekTo, live],
    )
    useEffect(() => {
        if (openKey) document.getElementById(`item-${openKey}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }, [openKey])

    const [toast, setToast] = useState<string | null>(null)
    const toastTimer = useRef<number | undefined>(undefined)
    const say = useCallback((msg: string) => {
        setToast(msg)
        window.clearTimeout(toastTimer.current)
        toastTimer.current = window.setTimeout(() => setToast(null), 2600)
    }, [])
    useEffect(() => () => window.clearTimeout(toastTimer.current), [])

    const persistDraft = () => {
        if (problems.length > 0) return false
        if (dirty) setLessonEdits(lesson.id, draft)
        return true
    }

    const toggleApprove = (key: string) => {
        if (reviewed.has(key)) {
            setReviewedItems(lesson.id, [...reviewed].filter((k) => k !== key))
            return
        }
        persistDraft()
        const next = new Set(reviewed).add(key)
        setReviewedItems(lesson.id, [...next])
        // Duyệt xong thì đóng mục này, mở mục chưa duyệt tiếp theo trong cùng tab
        const nxt = orderedKeys(tabOf(key), draft, stats).find((k) => !next.has(k))
        if (nxt) openItem(nxt)
        else setOpenKey(null)
    }

    const patchConcept = (i: number, patch: Partial<LessonEdits['concepts'][number]>) => setDraft((d) => ({ ...d, concepts: d.concepts.map((c, j) => (j === i ? { ...c, ...patch } : c)) }))
    const patchQuestion = (i: number, q: LessonQuizQuestion) => setDraft((d) => ({ ...d, quiz: d.quiz.map((old, j) => (j === i ? q : old)) }))

    // Nút AI phụ: gọi api/rewrite (Gemini ở server), có trạng thái đang tạo và lỗi thân thiện
    const [aiBusy, setAiBusy] = useState<string | null>(null)
    const [aiNote, setAiNote] = useState<{ key: string; text: string; error?: boolean } | null>(null)
    const runAi = async (key: string, req: Parameters<typeof rewriteContent>[0], apply: (res: Awaited<ReturnType<typeof rewriteContent>>) => void, okText: string) => {
        setAiBusy(key)
        setAiNote(null)
        try {
            apply(await rewriteContent(req))
            setAiNote({ key, text: okText })
        } catch (err) {
            setAiNote({ key, text: err instanceof ApiRequestError ? err.message : 'AI chưa viết lại được lúc này. Thầy cô thử lại sau nhé.', error: true })
        } finally {
            setAiBusy(null)
        }
    }

    const counts = {
        sum: { done: reviewed.has('sum') ? 1 : 0, all: 1 },
        con: { done: draft.concepts.filter((c) => reviewed.has(itemKey.concept(c.id))).length, all: draft.concepts.length },
        q: { done: draft.quiz.filter((q) => reviewed.has(itemKey.question(q.id))).length, all: draft.quiz.length },
    }
    const left = total - reviewed.size

    const onPublish = () => {
        if (left > 0) {
            const first = TAB_ORDER.flatMap((t) => orderedKeys(t, draft, stats).map((k) => [t, k] as const)).find(([, k]) => !reviewed.has(k))
            say('Còn mục chưa duyệt. Mở mục đầu tiên chưa duyệt.')
            if (first) {
                setTab(first[0])
                openItem(first[1])
            }
            return
        }
        if (dirty && !persistDraft()) return say(problems[0])
        setLessonReview(lesson.id, 'published')
        say('Đã xuất bản · lớp mẫu 32 sinh viên thấy bài ngay')
    }
    const onUnpublish = () => {
        setReviewedItems(lesson.id, [...reviewed])
        setLessonReview(lesson.id, 'draft')
        say('Đã gỡ xuất bản · sinh viên không còn thấy bài này')
    }
    const onSave = () => {
        if (!persistDraft()) return say(problems[0])
        say('Đã lưu chỉnh sửa')
    }
    const hasEdits = Boolean(savedEdits)
    const onRevert = () => {
        if (!window.confirm('Bỏ mọi chỉnh sửa và quay về bản AI tạo?')) return
        setLessonEdits(lesson.id, null)
        const original = lessonsOriginal(lesson.id)
        if (original) setDraft({ summary: original.summary, concepts: original.concepts, quiz: original.quiz })
    }

    const courseReviews = reviews.filter((r) => r.lesson.courseId === lesson.courseId)
    const [coverOpen, setCoverOpen] = useState(false)
    const nextPending = reviews.find((r) => !r.published && r.lesson.id !== lesson.id && reviews.indexOf(r) > reviews.indexOf(review)) ?? reviews.find((r) => !r.published && r.lesson.id !== lesson.id)

    return (
        <div className="lesson-page w-full" data-focus="off">
            <div className="container-wide lesson-body py-4 lg:py-6">
                <header className="lesson-grid items-end">
                    <TitleBlock
                        label={review.course?.title ?? 'Học phần'}
                        badge={`Bài ${review.index + 1}/${courseReviews.length}`}
                        items={courseReviews.map((r) => ({
                            key: r.lesson.id,
                            to: `/teacher/review/${r.lesson.id}`,
                            n: String(r.index + 1).padStart(2, '0'),
                            title: r.lesson.shortTitle ?? r.lesson.title,
                            meta: r.published ? 'đã xb' : `${r.done}/${r.total}`,
                            current: r.lesson.id === lesson.id,
                        }))}
                        footer={{ icon: <ImageIcon size={14} className="text-brand-ink" aria-hidden />, title: 'Đổi bìa môn học', meta: '', onClick: () => setCoverOpen(true) }}
                        title={lesson.title}
                        back={{ to: '/teacher/library', label: 'Bài giảng' }}
                    />
                    <StepPills
                        label="Các bước duyệt"
                        steps={[
                            { id: 'ai', label: 'AI tạo nội dung', done: true },
                            { id: 'review', label: 'Thầy cô duyệt', current: !published, done: published },
                            { id: 'pub', label: 'Xuất bản', current: published },
                        ]}
                    />
                </header>
                <div className="h-6" />

                <section className="lesson-grid lesson-theater">
                    <div ref={playerAreaRef} className="lesson-player-area relative [&:fullscreen]:flex [&:fullscreen]:items-center [&:fullscreen]:bg-ink">
                        <LessonPlayer containerRef={player.containerRef} status={player.status} error={player.error} youtubeId={lesson.youtubeId}>
                            <PlayerControls
                                lesson={live}
                                currentTime={player.currentTime}
                                duration={player.duration}
                                isPlaying={player.isPlaying}
                                rate={player.rate}
                                results={NO_RESULTS}
                                captionsOn={captionsOn}
                                panelHidden={false}
                                hidePanelToggle
                                onToggle={() => (player.isPlaying ? player.pause() : player.play())}
                                onSeek={(sec) => seekTo(sec, { play: player.isPlaying })}
                                onToggleCaptions={() => setCaptionsOn((v) => !v)}
                                onRate={player.setRate}
                                onFullscreen={() => (document.fullscreenElement ? void document.exitFullscreen() : void playerAreaRef.current?.requestFullscreen?.())}
                                onTogglePanel={() => undefined}
                                interactive={canPlay}
                                pinned={false}
                                youtubeId={lesson.youtubeId}
                                label={lesson.title}
                                isBuffering={player.isBuffering}
                                started={player.started}
                                onSeekBy={(delta) => seekTo(Math.min(lesson.durationSec, Math.max(0, player.currentTime + delta)), { play: player.isPlaying })}
                                quizMarker={(q) => {
                                    const ok = reviewed.has(itemKey.question(q.id))
                                    const rate = conceptRate(stats, q.conceptId)
                                    const hot = !ok && rate !== null && rate >= HOT_RATE
                                    const at = formatTime(q.pauseAt)
                                    return {
                                        state: ok ? 'approved' : hot ? 'hot' : 'pending',
                                        hint: ok ? `Câu ${at} · đã duyệt` : hot ? `Câu ${at} · ${rate}% sai · chưa duyệt` : `Câu ${at} · chưa duyệt`,
                                        current: openKey === itemKey.question(q.id),
                                    }
                                }}
                                onMarkerClick={(q) => {
                                    setTab('q')
                                    openItem(itemKey.question(q.id))
                                }}
                            />
                        </LessonPlayer>
                    </div>

                    <aside aria-label="Duyệt nội dung" className="lesson-side flex flex-col rounded-[20px] border border-border bg-card shadow-card">
                        <div role="tablist" aria-label="Loại nội dung" className="m-4 mb-0 flex shrink-0 gap-1 rounded-[14px] bg-muted p-1.5">
                            {(
                                [
                                    ['sum', 'Tóm tắt'],
                                    ['con', 'Khái niệm'],
                                    ['q', 'Câu hỏi'],
                                ] as [Tab, string][]
                            ).map(([id, label]) => (
                                <button
                                    key={id}
                                    type="button"
                                    role="tab"
                                    aria-selected={tab === id}
                                    onClick={() => setTab(id)}
                                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-[10px] px-1.5 py-[9px] text-[13.5px] font-bold transition duration-fast ${
                                        tab === id ? 'bg-card text-strong shadow-card' : 'text-muted-foreground hover:text-strong'
                                    }`}
                                >
                                    {label}
                                    <em className="font-mono text-[11.5px] font-semibold not-italic opacity-75">
                                        {counts[id].done}/{counts[id].all}
                                    </em>
                                </button>
                            ))}
                        </div>

                        <div role="tabpanel" className="min-h-0 flex-1 overflow-auto px-3 pb-3 pt-2">
                            {tab !== 'sum' && (
                                <p className="flex items-center justify-between px-1.5 pb-1.5 pt-2 text-xs text-muted-foreground">
                                    <span>
                                        Xếp theo <b className="font-bold text-strong">% lớp sai lần đầu</b>
                                    </span>
                                    <span>{tab === 'con' ? `${draft.concepts.length} khái niệm` : 'video dừng ở mỗi câu'}</span>
                                </p>
                            )}

                            {tab === 'sum' && (
                                <ReviewRow
                                    domId="item-sum"
                                    open={openKey === 'sum'}
                                    done={reviewed.has('sum')}
                                    title="Tóm tắt bài giảng"
                                    sub={`toàn bài · 0:00–${formatTime(lesson.durationSec)}`}
                                    onToggle={() => (openKey === 'sum' ? setOpenKey(null) : openItem('sum'))}
                                >
                                    <textarea aria-label="Tóm tắt bài giảng" rows={7} value={draft.summary} onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))} className={`${fieldCls} mt-2`} />
                                    <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
                                        AI tóm tắt từ transcript, mỗi ý dẫn về đúng đoạn:{' '}
                                        {draft.concepts.slice(0, 5).map((c, i) => (
                                            <span key={c.id}>
                                                {i > 0 && ' · '}
                                                <button type="button" onClick={() => seekTo(c.segment.start, { play: false })} className="font-mono font-bold text-brand-ink hover:underline">
                                                    {formatTime(c.segment.start)}
                                                </button>
                                            </span>
                                        ))}
                                    </p>
                                    <ItemActions
                                        approved={reviewed.has('sum')}
                                        approveLabel="Duyệt"
                                        onApprove={() => toggleApprove('sum')}
                                        ai={{
                                            label: '✦ Viết gọn hơn',
                                            busy: aiBusy === 'sum',
                                            onClick: () => void runAi('sum', { kind: 'shorten', lessonId: lesson.id, text: draft.summary }, (r) => r.text && setDraft((d) => ({ ...d, summary: r.text! })), 'AI vừa viết gọn tóm tắt. Đọc lại rồi duyệt.'),
                                        }}
                                        seek={{ label: '0:00', onClick: () => seekTo(0, { play: false }) }}
                                    />
                                    <AiNote note={aiNote} k="sum" />
                                </ReviewRow>
                            )}

                            {tab === 'con' && (
                                <div className="flex flex-col gap-1">
                                    {orderedKeys('con', draft, stats).map((key) => {
                                        const i = draft.concepts.findIndex((c) => itemKey.concept(c.id) === key)
                                        const c = draft.concepts[i]
                                        const rate = conceptRate(stats, c.id)
                                        return (
                                            <ReviewRow
                                                key={key}
                                                domId={`item-${key}`}
                                                open={openKey === key}
                                                done={reviewed.has(key)}
                                                title={c.name}
                                                sub={`${formatTime(c.segment.start)}–${formatTime(c.segment.end)}`}
                                                rate={rate}
                                                hot={rate !== null && rate >= HOT_RATE}
                                                onToggle={() => (openKey === key ? setOpenKey(null) : openItem(key))}
                                            >
                                                <label className={labelCls} htmlFor={`concept-name-${c.id}`}>
                                                    Tên khái niệm
                                                </label>
                                                <input id={`concept-name-${c.id}`} value={c.name} onChange={(e) => patchConcept(i, { name: e.target.value })} className={fieldCls} />
                                                <label className={labelCls} htmlFor={`concept-def-${c.id}`}>
                                                    Định nghĩa
                                                </label>
                                                <textarea id={`concept-def-${c.id}`} rows={3} value={c.definition} onChange={(e) => patchConcept(i, { definition: e.target.value })} className={fieldCls} />
                                                <ItemActions
                                                    approved={reviewed.has(key)}
                                                    approveLabel="Duyệt"
                                                    onApprove={() => toggleApprove(key)}
                                                    ai={{
                                                        label: '✦ Dễ hiểu hơn',
                                                        busy: aiBusy === key,
                                                        onClick: () => void runAi(key, { kind: 'simplify', lessonId: lesson.id, name: c.name, text: c.definition }, (r) => r.text && patchConcept(i, { definition: r.text }), 'AI vừa viết lại định nghĩa dễ hiểu hơn. Đọc lại rồi duyệt.'),
                                                    }}
                                                    seek={{ label: formatTime(c.segment.start), onClick: () => seekTo(c.segment.start, { play: false }) }}
                                                />
                                                <AiNote note={aiNote} k={key} />
                                            </ReviewRow>
                                        )
                                    })}
                                </div>
                            )}

                            {tab === 'q' && (
                                <div className="flex flex-col gap-1">
                                    {orderedKeys('q', draft, stats).map((key) => {
                                        const i = draft.quiz.findIndex((q) => itemKey.question(q.id) === key)
                                        const q = draft.quiz[i]
                                        const rate = conceptRate(stats, q.conceptId)
                                        const trapNote = TRAP_NOTES[q.id]
                                        return (
                                            <ReviewRow
                                                key={key}
                                                domId={`item-${key}`}
                                                open={openKey === key}
                                                done={reviewed.has(key)}
                                                title={q.prompt}
                                                sub={`dừng ở ${formatTime(q.pauseAt)}${q.variants.length ? ` · có ${q.variants.length} câu biến thể` : ''}`}
                                                rate={rate}
                                                hot={rate !== null && rate >= HOT_RATE}
                                                onToggle={() => (openKey === key ? setOpenKey(null) : openItem(key))}
                                            >
                                                <label className={labelCls} htmlFor={`${q.id}-prompt`}>
                                                    Câu hỏi
                                                </label>
                                                <textarea id={`${q.id}-prompt`} rows={2} value={q.prompt} onChange={(e) => patchQuestion(i, { ...q, prompt: e.target.value })} className={fieldCls} />
                                                <span className={labelCls}>Đáp án · bấm để chọn đáp án đúng · % sinh viên chọn</span>
                                                <OptionRows question={q} stats={stats} onChange={(next) => patchQuestion(i, { ...q, ...next })} />
                                                {trapNote && <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">{trapNote.note}</p>}
                                                <label className={labelCls} htmlFor={`${q.id}-explain`}>
                                                    Giải thích khi sinh viên sai
                                                </label>
                                                <textarea id={`${q.id}-explain`} rows={2} value={q.explanation} onChange={(e) => patchQuestion(i, { ...q, explanation: e.target.value })} className={fieldCls} />
                                                <VariantsBox variants={q.variants} onChange={(vi, next) => patchQuestion(i, { ...q, variants: q.variants.map((old, j) => (j === vi ? { ...old, ...next } : old)) })} />
                                                <ItemActions
                                                    approved={reviewed.has(key)}
                                                    approveLabel="Duyệt câu này"
                                                    onApprove={() => toggleApprove(key)}
                                                    ai={{
                                                        label: '✦ Viết lại đáp án nhiễu',
                                                        busy: aiBusy === key,
                                                        onClick: () =>
                                                            void runAi(
                                                                key,
                                                                { kind: 'distractors', lessonId: lesson.id, prompt: q.prompt, options: q.options, correctIndex: q.correctIndex },
                                                                (r) => r.options && patchQuestion(i, { ...q, options: r.options }),
                                                                'AI vừa viết lại 3 đáp án nhiễu. Đọc lại rồi duyệt.',
                                                            ),
                                                    }}
                                                    seek={{ label: formatTime(q.pauseAt), onClick: () => seekTo(q.pauseAt, { play: false }) }}
                                                />
                                                <AiNote note={aiNote} k={key} />
                                            </ReviewRow>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="shrink-0 border-t border-border px-4 pb-4 pt-3.5">
                            <p className="flex justify-between text-[12.5px] text-muted-foreground">
                                <span>Đã duyệt</span>
                                <b className="font-mono text-strong">{reviewed.size}/{total} mục</b>
                            </p>
                            <div className="mb-3 mt-2 h-[5px] overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={reviewed.size} aria-valuemax={total} aria-label="Tiến độ duyệt">
                                <div className="h-full rounded-full bg-mm-teal transition-[width] duration-slow" style={{ width: `${total ? (reviewed.size / total) * 100 : 0}%` }} />
                            </div>
                            {published ? (
                                <div className="flex gap-2">
                                    <button type="button" onClick={onUnpublish} className="h-[46px] flex-1 rounded-xl border border-border bg-card text-[15px] font-bold text-strong transition hover:bg-muted">
                                        Gỡ xuất bản
                                    </button>
                                    <button
                                        type="button"
                                        onClick={onSave}
                                        disabled={!dirty}
                                        className="surface-red h-[46px] flex-1 rounded-xl text-[15px] font-extrabold text-ink-foreground shadow-brand disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        Lưu chỉnh sửa
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={onPublish}
                                    className={`h-[46px] w-full rounded-xl text-[15px] font-extrabold transition ${
                                        left > 0 ? 'border border-brand-200 bg-card text-brand-ink hover:bg-brand-50' : 'surface-red text-ink-foreground shadow-brand'
                                    }`}
                                >
                                    Xuất bản cho lớp
                                </button>
                            )}
                            <p className="mt-2 text-center text-xs text-muted-foreground" aria-live="polite">
                                {problems.length > 0
                                    ? problems[0]
                                    : published
                                      ? 'Sinh viên đang xem được bài này.'
                                      : left > 0
                                        ? `Duyệt hết ${left} mục còn lại để xuất bản.`
                                        : 'Sinh viên sẽ thấy bài ngay sau khi xuất bản.'}{' '}
                                <span className="font-semibold" title={lesson.origin === 'gemini' ? 'Bản demo: nội dung được Gemini tạo sẵn từ video, không gọi API khi bấm' : undefined}>
                                    · {lesson.origin === 'gemini' ? 'Nội dung do Gemini tạo' : 'Dữ liệu mẫu'}
                                </span>
                                {hasEdits && (
                                    <>
                                        {' · '}
                                        <button type="button" onClick={onRevert} className="font-bold text-brand-ink hover:underline">
                                            Về bản AI
                                        </button>
                                    </>
                                )}
                            </p>
                        </div>
                    </aside>
                </section>

                <div className="lesson-grid items-start pt-6">
                    <TranscriptEditor
                        lines={live.transcript}
                        onSeek={(s) => seekTo(s, { play: false })}
                        onChange={(i, text) => setDraft((d) => ({ ...d, transcript: (d.transcript ?? lesson.transcript).map((s, j) => (j === i ? { ...s, text } : s)) }))}
                    />
                    <div className="justify-self-end">
                        {nextPending ? (
                            <Link to={`/teacher/review/${nextPending.lesson.id}`} className="inline-flex h-8 items-center gap-2 text-sm font-bold text-muted-foreground transition hover:text-strong">
                                Bài tiếp chờ duyệt: {nextPending.lesson.shortTitle ?? nextPending.lesson.title}
                                <ArrowRight size={15} className="text-brand-ink" aria-hidden />
                            </Link>
                        ) : (
                            <span className="inline-flex h-8 items-center text-sm font-bold text-muted-foreground">Không còn bài nào chờ duyệt</span>
                        )}
                    </div>
                </div>
            </div>

            <div
                role="status"
                className={`pointer-events-none fixed bottom-7 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-ink px-[18px] py-3 text-sm font-semibold text-ink-foreground shadow-raised transition duration-slow ${toast ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'}`}
            >
                {toast}
            </div>
            {coverOpen && <CoverDialog onClose={() => setCoverOpen(false)} />}
        </div>
    )
}

function AiNote({ note, k }: { note: { key: string; text: string; error?: boolean } | null; k: string }) {
    if (!note || note.key !== k) return null
    return (
        <p role={note.error ? 'alert' : 'status'} className={`mt-2 text-xs font-semibold ${note.error ? 'text-destructive' : 'text-success'}`}>
            {note.text}
        </p>
    )
}

/** Transcript AI tạo: mở ra sửa từng dòng (lỗi chính tả, tên riêng); phụ đề trên video cập nhật ngay. */
function TranscriptEditor({ lines, onSeek, onChange }: { lines: Lesson['transcript']; onSeek: (sec: number) => void; onChange: (i: number, text: string) => void }) {
    return (
        <details className="group relative min-w-0">
            <summary className="flex h-8 cursor-pointer list-none items-center gap-2.5 text-sm font-bold text-muted-foreground transition hover:text-strong [&::-webkit-details-marker]:hidden">
                <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full border border-border">
                    <Info size={13} aria-hidden />
                </span>
                Transcript AI tạo · {lines.length} dòng
                <ChevronDown size={13} className="transition-transform duration-fast group-open:rotate-180" aria-hidden />
            </summary>
            <div className="mt-2 max-h-[340px] overflow-auto rounded-[14px] border border-border bg-card p-2">
                {lines.map((s, i) => (
                    <div key={`${s.start}-${i}`} className="grid grid-cols-[48px_1fr] gap-2.5 rounded-xl px-2 py-1.5 hover:bg-muted">
                        <button type="button" onClick={() => onSeek(s.start)} className="pt-2 text-left font-mono text-xs font-semibold text-muted-foreground hover:text-brand-ink">
                            {formatTime(s.start)}
                        </button>
                        <textarea aria-label={`Dòng transcript tại ${formatTime(s.start)}`} rows={2} value={s.text} onChange={(e) => onChange(i, e.target.value)} className={fieldCls} />
                    </div>
                ))}
            </div>
        </details>
    )
}

function CoverDialog({ onClose }: { onClose: () => void }) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [onClose])
    return (
        <div role="dialog" aria-modal="true" aria-label="Đổi bìa môn học" className="fixed inset-0 z-[80] overflow-auto bg-ink/60 p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div className="mx-auto max-w-5xl rounded-[20px] border border-border bg-card p-6 shadow-raised">
                <div className="mb-5 flex items-center justify-between">
                    <h2 className="text-xl font-black text-strong">Đổi bìa môn học</h2>
                    <button type="button" onClick={onClose} aria-label="Đóng" className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted">
                        <X size={18} />
                    </button>
                </div>
                <CoverEditor />
            </div>
        </div>
    )
}
