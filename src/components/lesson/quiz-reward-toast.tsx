import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { QuizReward } from '@/hooks/useLessonQuiz'

const MESSAGE: Record<QuizReward['outcome'], string> = {
    correct: 'Trả lời đúng',
    corrected: 'Sửa được lỗi sai · XP gấp đôi',
    missed: 'Đã ghi nhận, khái niệm này sẽ được ôn lại',
}

/** Thông báo XP nhỏ ở góc màn hình, tự ẩn sau vài giây. */
export function QuizRewardToast({ reward }: { reward: QuizReward | null }) {
    const [visible, setVisible] = useState<QuizReward | null>(null)

    useEffect(() => {
        if (!reward) return
        setVisible(reward)
        const t = window.setTimeout(() => setVisible(null), 3200)
        return () => window.clearTimeout(t)
    }, [reward])

    return (
        <div className="pointer-events-none fixed bottom-6 right-6 z-[60]" aria-live="polite">
            <AnimatePresence>
                {visible && (
                    <motion.div
                        key={visible.key}
                        initial={{ opacity: 0, y: 24, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 12, scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                        className={`flex items-center gap-4 rounded-card px-5 py-4 shadow-raised ${
                            visible.xp > 0 ? 'bg-brand-600 text-white shadow-brand' : 'bg-ink text-white'
                        }`}
                    >
                        {visible.xp > 0 && (
                            <motion.span
                                initial={{ scale: 0.6 }}
                                animate={{ scale: [0.6, 1.15, 1] }}
                                transition={{ duration: 0.5 }}
                                className="font-mono text-2xl font-bold"
                            >
                                +{visible.xp} XP
                            </motion.span>
                        )}
                        <span className="text-sm font-semibold text-white/90">
                            {visible.repeat ? 'Ôn lại câu đã làm, không cộng XP' : MESSAGE[visible.outcome]}
                        </span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
