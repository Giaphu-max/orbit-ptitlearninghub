import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { ArrowDown, Crosshair, MoreHorizontal, Play, Send, Sparkles } from 'lucide-react'
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
}

export function TutorPanel({ lesson, getCurrentTime, onSeek }: TutorPanelProps) {
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

    return (
        <aside className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-panel border border-border bg-card shadow-card">
            <header className="flex shrink-0 items-center gap-3 border-b border-border bg-gradient-to-r from-brand-50 to-card px-5 py-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-100 text-brand-ink">
                    <Sparkles size={18} />
                </span>
                <div>
                    <h2 className="font-bold text-gray-900">Trợ giảng AI</h2>
                    <p className="text-xs text-gray-500">Trả lời theo bài giảng, có mốc để xem lại</p>
                </div>
            </header>

            <div
                ref={listRef}
                onScroll={handleScroll}
                className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain bg-gray-50/60 p-5"
                aria-live="polite"
            >
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        {msg.role === 'ai' && (
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100">
                                <Sparkles size={14} className="text-brand-ink" />
                            </span>
                        )}
                        <div className={`flex min-w-0 flex-col gap-2 ${msg.role === 'user' ? 'items-end' : ''}`}>
                            <div
                                className={`prose prose-sm max-w-none break-words dark:prose-invert rounded-2xl p-3.5 text-sm leading-relaxed shadow-sm ${
                                    msg.role === 'user'
                                        ? 'prose-invert rounded-tr-sm bg-ink text-white dark:border dark:border-border'
                                        : msg.isError
                                          ? 'rounded-tl-sm border border-brand-100 bg-brand-50 text-brand-ink'
                                          : 'rounded-tl-sm border border-gray-100 bg-card text-gray-700'
                                }`}
                            >
                                <ReactMarkdown>{msg.text}</ReactMarkdown>
                            </div>
                            {msg.citations && msg.citations.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {msg.citations.map((c) => (
                                        <button
                                            key={c.start}
                                            type="button"
                                            onClick={() => onSeek(c.start)}
                                            className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-ink transition duration-fast hover:bg-brand-100"
                                            title="Tua video tới đoạn này"
                                        >
                                            <Play size={10} className="fill-current" />
                                            <span className="font-mono">{formatTime(c.start)}</span>
                                            <span className="text-brand-ink/80">{c.label}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {isTyping && (
                    <div className="flex gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100">
                            <Sparkles size={14} className="text-brand-ink" />
                        </span>
                        <div className="rounded-2xl rounded-tl-sm border border-gray-100 bg-card p-3.5 text-sm text-gray-500 shadow-sm">
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
                    className="absolute bottom-36 left-1/2 z-10 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-gray-200 bg-card/90 text-gray-700 shadow-md backdrop-blur transition hover:bg-gray-100"
                    aria-label="Xuống tin mới nhất"
                >
                    {isTyping ? <MoreHorizontal size={16} className="animate-pulse text-brand-500" /> : <ArrowDown size={16} />}
                </button>
            )}

            <div className="shrink-0 border-t border-border bg-card p-4">
                <form
                    className="relative"
                    onSubmit={(e) => {
                        e.preventDefault()
                        send(inputValue)
                    }}
                >
                    <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        maxLength={CHAT_LIMITS.questionMaxChars}
                        placeholder="Hỏi về bài giảng…"
                        aria-label="Câu hỏi cho trợ giảng AI"
                        className="w-full rounded-full border border-gray-200 bg-gray-50 py-3 pl-5 pr-12 text-sm outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
                    />
                    <button
                        type="submit"
                        disabled={isTyping || !inputValue.trim()}
                        className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-brand-600 text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                        aria-label="Gửi câu hỏi"
                    >
                        <Send size={14} />
                    </button>
                </form>
                <div className="mt-3 flex flex-wrap gap-2">
                    <button
                        type="button"
                        disabled={isTyping}
                        onClick={() => send('Giải thích giúp mình đoạn đang xem.')}
                        className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-ink transition hover:bg-brand-100 disabled:opacity-50"
                    >
                        <Crosshair size={12} /> Hỏi về đoạn đang xem
                    </button>
                    {lesson.concepts.map((c) => (
                        <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                                setInputValue(`${c.name} là gì?`)
                                inputRef.current?.focus()
                            }}
                            className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 transition hover:bg-gray-200"
                        >
                            {c.name}
                        </button>
                    ))}
                </div>
            </div>
        </aside>
    )
}
