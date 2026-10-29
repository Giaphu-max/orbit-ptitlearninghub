import { memo, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { ArrowDown, Camera, MoreHorizontal, Play, Send, Sparkles } from 'lucide-react'
import type { Lesson } from '@/data/types'
import { askTutor } from '@/lib/api'
import { CHAT_LIMITS, type ChatCitation, type ChatTurn } from '@/lib/api-types'
import { formatTime } from '@/lib/youtube'

interface ChatMessage {
    role: 'ai' | 'user'
    text: string
    citations?: ChatCitation[]
    /** Tin báo lỗi: hiện cho người dùng nhưng không gửi lại làm ngữ cảnh */
    isError?: boolean
}

interface TutorPanelProps {
    lesson: Lesson
    /** Đọc thời điểm đang xem lúc gửi câu hỏi (không cần render lại theo từng giây) */
    getCurrentTime: () => number
    onSeek: (sec: number) => void
    /** Giây nguyên đang xem, chỉ để ghi nhãn gợi ý "Giải thích đoạn mm:ss" */
    currentSec: number
    /** Liên kết gợi ý sang Studio 3D (bài Nhiếp ảnh), thiếu thì không hiện */
    studio?: { to: string; label: string }
}

const AiAvatar = () => (
    <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] bg-brand-50 text-brand-ink">
        <Sparkles size={14} />
    </span>
)

/** Danh sách tin nhắn: memo để khung chat không dựng lại markdown mỗi lần đồng hồ video nhích */
const Messages = memo(function Messages({ messages, onSeek }: { messages: ChatMessage[]; onSeek: (sec: number) => void }) {
    return (
        <>
            {messages.map((msg, idx) => (
                <div key={idx} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                    {msg.role === 'ai' && <AiAvatar />}
                    <div className={`flex min-w-0 flex-col gap-1.5 ${msg.role === 'user' ? 'items-end' : ''}`}>
                        <div
                            className={`prose prose-sm max-w-none break-words rounded-[14px] px-3.5 py-[11px] text-sm leading-[1.55] dark:prose-invert ${
                                msg.role === 'user'
                                    ? 'prose-invert bg-ink text-ink-foreground'
                                    : msg.isError
                                      ? 'border border-brand-100 bg-brand-50 text-brand-ink'
                                      : 'bg-muted text-foreground'
                            }`}
                        >
                            <ReactMarkdown>{msg.text}</ReactMarkdown>
                        </div>
                        {msg.citations && msg.citations.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                {msg.citations.map((c) => (
                                    <button
                                        key={c.start}
                                        type="button"
                                        onClick={() => onSeek(c.start)}
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-card px-2.5 py-1 text-xs font-bold text-brand-ink transition duration-fast hover:bg-brand-50"
                                        title="Tua video tới đoạn này"
                                    >
                                        <Play size={10} className="fill-current" />
                                        <span className="font-mono">{formatTime(c.start)}</span>
                                        <span className="font-sans font-semibold text-brand-ink/80">{c.label}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </>
    )
})

export function TutorPanel({ lesson, getCurrentTime, onSeek, currentSec, studio }: TutorPanelProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            role: 'ai',
            text: `Chào bạn! Mình là trợ giảng AI của bài **${lesson.title}**. Mình chỉ trả lời dựa trên nội dung bài giảng, kèm mốc thời gian để bạn xem lại đúng đoạn.`,
        },
    ])
    const [inputValue, setInputValue] = useState('')
    const [isTyping, setIsTyping] = useState(false)
    const [isScrolledUp, setIsScrolledUp] = useState(false)
    const listRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const followRef = useRef(true)

    const scrollToBottom = () => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
    }

    useEffect(() => {
        if (followRef.current) scrollToBottom()
    }, [messages, isTyping])

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollHeight, scrollTop, clientHeight } = e.currentTarget
        const away = scrollHeight - scrollTop - clientHeight > 80
        followRef.current = !away
        setIsScrolledUp(away)
    }

    const send = async (raw: string) => {
        const question = raw.trim()
        if (!question || isTyping) return

        // Lượt chào đầu, tin lỗi và câu hỏi đã bị lỗi không gửi làm ngữ cảnh
        const history: ChatTurn[] = messages
            .slice(1)
            .filter((m, i, arr) => !m.isError && !(m.role === 'user' && arr[i + 1]?.isError))
            .map((m) => ({ role: m.role === 'ai' ? 'assistant' : 'user', text: m.text }))

        setMessages((prev) => [...prev, { role: 'user', text: question }])
        setInputValue('')
        setIsTyping(true)
        followRef.current = true
        setIsScrolledUp(false)

        try {
            const res = await askTutor({ lessonId: lesson.id, question, history, currentTimeSec: getCurrentTime() })
            setMessages((prev) => [...prev, { role: 'ai', text: res.answer, citations: res.citations }])
        } catch (error) {
            const text = error instanceof Error ? error.message : 'Trợ giảng AI chưa trả lời được lúc này. Bạn thử lại nhé.'
            setMessages((prev) => [...prev, { role: 'ai', text, isError: true }])
        } finally {
            setIsTyping(false)
        }
    }

    // Gợi ý theo khái niệm: khái niệm đang giảng trước, rồi tới các khái niệm còn lại
    const activeId = lesson.concepts.find((c) => currentSec >= c.segment.start && currentSec < c.segment.end)?.id
    const suggested = [...lesson.concepts].sort((a, b) => Number(b.id === activeId) - Number(a.id === activeId)).slice(0, 2)

    return (
        <div className="relative flex h-full min-h-0 flex-col">
            <div ref={listRef} onScroll={handleScroll} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4" aria-live="polite">
                <Messages messages={messages} onSeek={onSeek} />
                {isTyping && (
                    <div className="flex gap-2.5">
                        <AiAvatar />
                        <div className="rounded-[14px] bg-muted px-3.5 py-[11px] text-sm text-muted-foreground">
                            <span className="animate-pulse">Đang xem lại bài giảng…</span>
                        </div>
                    </div>
                )}
            </div>

            {isScrolledUp && (
                <button
                    type="button"
                    onClick={() => {
                        followRef.current = true
                        setIsScrolledUp(false)
                        scrollToBottom()
                    }}
                    className="absolute bottom-36 left-1/2 z-10 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-md transition hover:bg-muted"
                    aria-label="Xuống tin mới nhất"
                >
                    {isTyping ? <MoreHorizontal size={16} className="animate-pulse text-brand-500" /> : <ArrowDown size={16} />}
                </button>
            )}

            <div className="shrink-0 border-t border-border p-4">
                <form
                    onSubmit={(e) => {
                        e.preventDefault()
                        send(inputValue)
                    }}
                    className="flex h-11 items-center gap-2 rounded-full border border-border bg-card pl-3.5 pr-1.5 transition focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-100"
                >
                    <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        maxLength={CHAT_LIMITS.questionMaxChars}
                        placeholder="Hỏi về đoạn đang xem…"
                        aria-label="Câu hỏi cho trợ giảng AI"
                        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    />
                    <button
                        type="submit"
                        disabled={isTyping || !inputValue.trim()}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-ink-foreground transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
                        aria-label="Gửi câu hỏi"
                    >
                        <Send size={14} />
                    </button>
                </form>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <button
                        type="button"
                        disabled={isTyping}
                        onClick={() => send('Giải thích giúp mình đoạn đang xem.')}
                        className="rounded-full bg-brand-50 px-2.5 py-1 text-[12.5px] font-semibold text-brand-ink transition hover:bg-brand-100 disabled:opacity-50"
                    >
                        Giải thích đoạn <span className="font-mono">{formatTime(currentSec)}</span>
                    </button>
                    {suggested.map((c) => (
                        <button
                            key={c.id}
                            type="button"
                            disabled={isTyping}
                            onClick={() => send(`${c.name} là gì?`)}
                            className="rounded-full bg-muted px-2.5 py-1 text-[12.5px] font-semibold text-strong transition hover:bg-border disabled:opacity-50"
                        >
                            {c.name} là gì?
                        </button>
                    ))}
                </div>
                {studio && (
                    <Link to={studio.to} className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-bold text-brand-ink hover:underline">
                        <Camera size={14} /> {studio.label} →
                    </Link>
                )}
            </div>
        </div>
    )
}
