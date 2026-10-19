import { useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { motion } from 'motion/react'
import { ArrowRight, Check, Loader2, PlayCircle, RotateCcw, Sparkles, X } from 'lucide-react'
import type { Lesson } from '@/data/types'
import type { QuizPhase } from '@/hooks/useLessonQuiz'
import { questionAt, QUIZ_XP } from '@/lib/quiz'
import { formatTime } from '@/lib/youtube'

interface QuizCardProps {
    lesson: Lesson
    phase: Extract<QuizPhase, { kind: 'asking' | 'answered' }>
    canPlay: boolean
    /** Câu đã có kết quả từ trước: làm lại để ôn, không cộng XP */
    isRepeat: boolean
    onAnswer: (index: number) => void
    onReview: () => void
    onNextVariant: () => void
    onResume: () => void
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

export function QuizCard({ lesson, phase, canPlay, isRepeat, onAnswer, onReview, onNextVariant, onResume }: QuizCardProps) {
    const { root, attempt } = phase
    const question = questionAt(root, attempt)!
    const concept = lesson.concepts.find((c) => c.id === question.conceptId)
    const answered = phase.kind === 'answered' ? phase : null
    const hasNextVariant = !!questionAt(root, attempt + 1)

    // Đưa focus ra khỏi iframe YouTube vào thẻ câu hỏi, để đọc màn hình và phím tắt dùng được ngay
    const cardRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
        cardRef.current?.focus({ preventScroll: true })
    }, [question.id])

    // Phím 1–4 hoặc A–D để chọn nhanh
    useEffect(() => {
        if (answered) return
        const onKey = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
            const k = e.key.toUpperCase()
            const index = /^[1-9]$/.test(k) ? Number(k) - 1 : LETTERS.indexOf(k)
            if (index >= 0 && index < question.options.length) onAnswer(index)
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [answered, question.options.length, onAnswer])

    const xpIfCorrect = attempt === 0 ? QUIZ_XP.correct : QUIZ_XP.corrected
    const explain = answered?.explain
    const reviewRange = explain && explain.status !== 'loading' ? explain.review : null
    const reviewText = reviewRange
        ? lesson.transcript.filter((s) => s.start >= reviewRange.start && s.start < reviewRange.end).map((s) => s.text).join(' ')
        : ''

    return (
        <motion.div
            ref={cardRef}
            tabIndex={-1}
            key={question.id}
            role="dialog"
            aria-modal="false"
            aria-labelledby={`quiz-${question.id}`}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-2xl rounded-panel bg-card p-5 outline-none text-card-foreground shadow-raised md:max-h-full md:overflow-y-auto md:p-6"
        >
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-eyebrow uppercase text-brand-ink">
                    {attempt === 0 ? 'Câu hỏi nhanh' : `Câu tương tự ${attempt}/${root.variants.length}`}
                </span>
                {concept && <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">{concept.name}</span>}
                <span className="ml-auto font-mono text-xs text-gray-400">{formatTime(root.pauseAt)}</span>
            </div>

            <h2 id={`quiz-${question.id}`} className="mt-3 text-lg font-bold leading-snug text-gray-900 md:text-title">
                {question.prompt}
            </h2>

            <div className="mt-4 grid gap-2" role="radiogroup" aria-label="Các phương án">
                {question.options.map((option, i) => {
                    const isChosen = answered?.chosen === i
                    const isCorrectOption = i === question.correctIndex
                    // Sai thì chưa lộ đáp án đúng nếu còn câu tương tự, để câu sau vẫn có ý nghĩa
                    const revealCorrect = answered && (answered.correct || !hasNextVariant)
                    // Đã trả lời: thu gọn, chỉ giữ phương án đã chọn (và đáp án đúng nếu được lộ) để chừa chỗ cho giải thích
                    if (answered && !isChosen && !(revealCorrect && isCorrectOption)) return null
                    let tone = 'border-border bg-card hover:border-brand-300 hover:bg-brand-50/50'
                    if (answered) {
                        if (isChosen && answered.correct) tone = 'border-success bg-success/10 text-gray-900'
                        else if (isChosen) tone = 'border-brand-400 bg-brand-50 text-gray-900'
                        else if (revealCorrect && isCorrectOption) tone = 'border-success/60 bg-success/5'
                        else tone = 'border-border bg-card opacity-60'
                    }
                    return (
                        <motion.button
                            key={i}
                            type="button"
                            role="radio"
                            aria-checked={isChosen}
                            disabled={!!answered}
                            onClick={() => onAnswer(i)}
                            animate={isChosen && answered && !answered.correct ? { x: [0, -6, 6, -4, 4, 0] } : isChosen && answered?.correct ? { scale: [1, 1.02, 1] } : {}}
                            transition={{ duration: 0.35 }}
                            className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-[15px] transition duration-fast disabled:cursor-default ${tone}`}
                        >
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-100 font-mono text-xs font-bold text-gray-600">
                                {answered && isChosen ? answered.correct ? <Check size={14} className="text-success" /> : <X size={14} className="text-brand-ink" /> : LETTERS[i]}
                            </span>
                            <span className="text-gray-800">{option}</span>
                        </motion.button>
                    )
                })}
            </div>

            {!answered && (
                <p className="mt-3 text-xs text-gray-500">
                    Chọn một đáp án (phím 1–{question.options.length}).{' '}
                    {isRepeat ? 'Bạn đã làm câu này, lần này để ôn lại nên không cộng XP.' : `Đúng được +${xpIfCorrect} XP.`}
                </p>
            )}

            {answered?.correct && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-card bg-success/10 p-4">
                    <p className="font-bold text-gray-900">
                        {attempt === 0 ? 'Chính xác!' : 'Sửa đúng rồi, bạn đã hiểu chỗ này!'}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-gray-700">{question.explanation}</p>
                </motion.div>
            )}

            {answered && !answered.correct && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 space-y-3">
                    <div className="rounded-card border border-brand-100 bg-brand-50 p-4">
                        <p className="flex items-center gap-2 font-bold text-gray-900">
                            <Sparkles size={16} className="text-brand-ink" /> Chưa đúng, cùng xem lại nhé
                        </p>
                        {explain?.status === 'loading' ? (
                            <p className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                                <Loader2 size={14} className="animate-spin" /> Trợ giảng đang xem lại bài giảng để giải thích…
                            </p>
                        ) : (
                            <div className="prose prose-sm mt-2 max-w-none dark:prose-invert text-gray-700">
                                <ReactMarkdown>{explain?.text ?? question.explanation}</ReactMarkdown>
                            </div>
                        )}
                        {explain?.status === 'fallback' && (
                            <p className="mt-2 text-xs text-gray-500">({explain.error} Đây là giải thích soạn sẵn của bài.)</p>
                        )}
                    </div>
                    {reviewRange && reviewText && (
                        <blockquote className="border-l-4 border-brand-200 pl-4 text-sm leading-relaxed text-gray-600">
                            <span className="mr-2 font-mono text-xs text-brand-ink">
                                {formatTime(reviewRange.start)}–{formatTime(reviewRange.end)}
                            </span>
                            {reviewText}
                        </blockquote>
                    )}
                    {!hasNextVariant && (
                        <p className="text-sm text-gray-600">
                            Đáp án đúng: <strong>{question.options[question.correctIndex]}</strong>. Khái niệm này sẽ được ưu tiên trong Orbit Daily để bạn ôn lại.
                        </p>
                    )}
                </motion.div>
            )}

            {answered && (
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                    {!answered.correct && hasNextVariant ? (
                        <>
                            <button
                                type="button"
                                onClick={onNextVariant}
                                disabled={explain?.status === 'loading'}
                                className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-4 py-2.5 text-sm font-bold text-gray-800 transition hover:bg-gray-200 disabled:opacity-50"
                            >
                                <RotateCcw size={15} /> Thử câu tương tự
                            </button>
                            {canPlay && (
                                <button
                                    type="button"
                                    onClick={onReview}
                                    disabled={!reviewRange}
                                    className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow-brand transition hover:bg-brand-700 disabled:opacity-50"
                                >
                                    <PlayCircle size={15} />
                                    {reviewRange ? `Xem lại đoạn ${formatTime(reviewRange.start)}` : 'Xem lại đoạn giảng'}
                                </button>
                            )}
                        </>
                    ) : (
                        <button
                            type="button"
                            onClick={onResume}
                            className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-brand transition hover:bg-brand-700"
                        >
                            {canPlay ? 'Xem tiếp' : 'Đóng'} <ArrowRight size={15} />
                        </button>
                    )}
                </div>
            )}
        </motion.div>
    )
}
