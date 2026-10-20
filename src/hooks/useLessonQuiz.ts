import { useCallback, useEffect, useRef, useState } from 'react'
import type { Lesson, LessonQuizQuestion } from '@/data/types'
import { explainAnswer } from '@/lib/api'
import { questionAt, type QuizOutcome } from '@/lib/quiz'
import { announceRewards, lessonCompleteScreen } from '@/lib/gamification'
import { useOrbitStore } from '@/store/useOrbitStore'

// Vòng quiz củng cố trong video:
//   video chạy tới mốc → dừng, hỏi câu gốc
//   đúng → cộng XP, xem tiếp
//   sai  → AI giải thích → xem lại đoạn chứa đáp án → hỏi câu biến thể cùng cấp độ
//          (tối đa 2 biến thể; sửa đúng được XP gấp đôi, sai hết thì ghi nhận và xem tiếp)

export interface ReviewRange {
    start: number
    end: number
}

export type Explain =
    | { status: 'loading' }
    | { status: 'ready'; text: string; review: ReviewRange }
    /** API lỗi: dùng giải thích soạn sẵn trong dữ liệu */
    | { status: 'fallback'; text: string; review: ReviewRange; error: string }

export type QuizPhase =
    | { kind: 'idle' }
    | { kind: 'asking'; root: LessonQuizQuestion; attempt: number }
    | { kind: 'answered'; root: LessonQuizQuestion; attempt: number; chosen: number; correct: boolean; explain?: Explain }
    | { kind: 'reviewing'; root: LessonQuizQuestion; nextAttempt: number; review: ReviewRange }

export interface QuizReward {
    key: number
    xp: number
    outcome: QuizOutcome
    /** Câu đã làm trước đó: không cộng XP lần nữa */
    repeat: boolean
}

interface PlayerControls {
    currentTime: number
    isPlaying: boolean
    /** Có trình phát thật (không phải chế độ mô phỏng) */
    canPlay: boolean
    seekTo: (sec: number, opts?: { play?: boolean }) => void
    pause: () => void
}

/** Lần chạy tự nhiên giữa hai lần đo thời gian không vượt quá mức này; lớn hơn là người dùng tua. */
const NATURAL_PLAYBACK_GAP = 2

export function useLessonQuiz(lesson: Lesson, player: PlayerControls) {
    const { currentTime, isPlaying, canPlay, seekTo, pause } = player
    const recordQuizResult = useOrbitStore((s) => s.recordQuizResult)
    const quizResults = useOrbitStore((s) => s.quizResults)

    const [phase, setPhase] = useState<QuizPhase>({ kind: 'idle' })
    const [reward, setReward] = useState<QuizReward | null>(null)
    const prevTimeRef = useRef(currentTime)
    const requestRef = useRef(0)

    const open = useCallback(
        (root: LessonQuizQuestion) => {
            pause()
            setPhase({ kind: 'asking', root, attempt: 0 })
        },
        [pause],
    )

    // Video chạy qua mốc câu hỏi chưa làm → dừng và hỏi
    useEffect(() => {
        const prev = prevTimeRef.current
        prevTimeRef.current = currentTime
        if (!isPlaying) return

        if (phase.kind === 'reviewing') {
            if (currentTime >= phase.review.end) {
                pause()
                setPhase({ kind: 'asking', root: phase.root, attempt: phase.nextAttempt })
            }
            return
        }
        if (phase.kind !== 'idle') return
        const gap = currentTime - prev
        if (gap <= 0 || gap > NATURAL_PLAYBACK_GAP) return
        // prev <= pauseAt: bắt cả trường hợp tiếp tục xem đúng tại mốc câu hỏi
        const due = lesson.quiz.find((q) => prev <= q.pauseAt && q.pauseAt <= currentTime && !quizResults[q.id])
        if (due) open(due)
    }, [currentTime, isPlaying, phase, lesson.quiz, quizResults, open, pause])

    const finish = useCallback(
        (root: LessonQuizQuestion, outcome: QuizOutcome, attempts: number) => {
            const before = useOrbitStore.getState()
            const repeat = !!before.quizResults[root.id]
            const wasDone = before.lessonProgress[lesson.id]?.completed ?? false
            const xp = recordQuizResult({
                lessonId: lesson.id,
                conceptId: root.conceptId,
                questionId: root.id,
                outcome,
                attempts,
                lessonQuestionIds: lesson.quiz.map((q) => q.id),
            })
            setReward({ key: Date.now(), xp, outcome, repeat })

            // Màn thưởng phủ đỏ chỉ ở khoảnh khắc đáng nhớ: xong bài, lên cấp, huy hiệu mới
            const after = useOrbitStore.getState()
            const lessonDone = !wasDone && (after.lessonProgress[lesson.id]?.completed ?? false)
            announceRewards(before, after, lessonDone ? lessonCompleteScreen(lesson, after.quizResults, root.conceptId) : undefined, { afterAnswer: true })
        },
        [lesson, recordQuizResult],
    )

    const answer = useCallback(
        (chosen: number) => {
            if (phase.kind !== 'asking') return
            const { root, attempt } = phase
            const question = questionAt(root, attempt)
            if (!question) return
            const correct = chosen === question.correctIndex

            if (correct) {
                setPhase({ kind: 'answered', root, attempt, chosen, correct })
                finish(root, attempt === 0 ? 'correct' : 'corrected', attempt + 1)
                return
            }

            const isLast = !questionAt(root, attempt + 1)
            if (isLast) finish(root, 'missed', attempt + 1)

            const concept = lesson.concepts.find((c) => c.id === question.conceptId)
            const fallbackReview = root.answerSegment ?? (concept ? { ...concept.segment } : { start: Math.max(0, root.pauseAt - 60), end: root.pauseAt })
            setPhase({ kind: 'answered', root, attempt, chosen, correct, explain: { status: 'loading' } })

            const requestId = ++requestRef.current
            explainAnswer({ lessonId: lesson.id, questionId: question.id, chosenIndex: chosen })
                .then((res): Explain => ({ status: 'ready', text: res.explanation, review: res.review }))
                .catch((err: Error): Explain => ({ status: 'fallback', text: question.explanation, review: fallbackReview, error: err.message }))
                .then((explain) => {
                    // Bỏ kết quả cũ nếu sinh viên đã chuyển sang câu khác
                    if (requestRef.current !== requestId) return
                    setPhase((p) => (p.kind === 'answered' && p.root.id === root.id && p.attempt === attempt ? { ...p, explain } : p))
                })
        },
        [phase, lesson.id, lesson.concepts, finish],
    )

    /** Sau khi sai: xem lại đoạn video chứa đáp án rồi mới hỏi câu biến thể. */
    const review = useCallback(() => {
        if (phase.kind !== 'answered' || phase.correct || !phase.explain || phase.explain.status === 'loading') return
        const range = phase.explain.review
        requestRef.current++
        setPhase({ kind: 'reviewing', root: phase.root, nextAttempt: phase.attempt + 1, review: range })
        seekTo(range.start, { play: true })
    }, [phase, seekTo])

    /** Hỏi câu biến thể ngay (bỏ qua bước xem lại). */
    const nextVariant = useCallback(() => {
        if (phase.kind === 'answered' && !phase.correct && questionAt(phase.root, phase.attempt + 1)) {
            requestRef.current++
            setPhase({ kind: 'asking', root: phase.root, attempt: phase.attempt + 1 })
        } else if (phase.kind === 'reviewing') {
            pause()
            setPhase({ kind: 'asking', root: phase.root, attempt: phase.nextAttempt })
        }
    }, [phase, pause])

    /** Xong câu: xem tiếp từ mốc câu hỏi. */
    const resume = useCallback(() => {
        if (phase.kind === 'idle') return
        const root = phase.root
        requestRef.current++
        setPhase({ kind: 'idle' })
        prevTimeRef.current = root.pauseAt
        if (canPlay) seekTo(root.pauseAt, { play: true })
    }, [phase, canPlay, seekTo])

    return { phase, reward, open, answer, review, nextVariant, resume, results: quizResults }
}
