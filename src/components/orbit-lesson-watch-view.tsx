'use client'

import { useState, useRef, useEffect } from 'react'
import { Play, Pause, Volume2, Maximize, Send, CheckCircle2, Settings, Sparkles, PanelRightClose, MessageSquare, ArrowDown, MoreHorizontal, ChevronLeft } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { useNavigate } from 'react-router-dom'

interface OrbitLessonWatchViewProps {
    onBack?: () => void
}

export function OrbitLessonWatchView({ onBack }: OrbitLessonWatchViewProps = {}) {
    const navigate = useNavigate()

    const handleBack = () => {
        if (onBack) onBack()
        else navigate('/learning')
    }
    const [isChatOpen, setIsChatOpen] = useState(true)
    const [messages, setMessages] = useState([
        { role: 'ai', text: 'Xin chào! Tôi là trợ lý học tập AI. Bạn đang xem bài "Thiết kế giao diện trong Figma". Bạn có câu hỏi nào cần giải đáp không?' }
    ])
    const [inputValue, setInputValue] = useState('')
    const [isTyping, setIsTyping] = useState(false)
    const [isScrolledUp, setIsScrolledUp] = useState(false)
    const chatContainerRef = useRef<HTMLDivElement>(null)

    const scrollToBottom = () => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTo({
                top: chatContainerRef.current.scrollHeight,
                behavior: 'smooth'
            })
        }
    }

    useEffect(() => {
        if (!isScrolledUp) {
            scrollToBottom()
        }
    }, [messages, isTyping])

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollHeight, scrollTop, clientHeight } = e.currentTarget
        if (scrollHeight - scrollTop - clientHeight > 80) {
            setIsScrolledUp(true)
        } else {
            setIsScrolledUp(false)
        }
    }

    const handleSendMessage = async () => {
        if (!inputValue.trim()) return
        
        const userMessage = inputValue.trim()
        setMessages(prev => [...prev, { role: 'user', text: userMessage }])
        setInputValue('')
        setIsTyping(true)
        
        setTimeout(() => {
            setIsScrolledUp(false)
            scrollToBottom()
        }, 50)

        try {
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: userMessage }] }] })
            })
            const data = await response.json()
            if (!response.ok) {
                console.error("Google API Details:", data)
                throw new Error(data.error?.message || `HTTP Error ${response.status}`)
            }
            const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Xin lỗi, tôi không thể xử lý câu hỏi này lúc này.'
            setMessages(prev => [...prev, { role: 'ai', text: aiText }])
        } catch (error: any) {
            console.error('Gemini API Error:', error)
            setMessages(prev => [...prev, { role: 'ai', text: `Lỗi API: ${error.message}` }])
        } finally {
            setIsTyping(false)
        }
    }

    return (
        <main className="relative flex-1 h-full w-full overflow-y-auto bg-surface p-4 lg:p-6">
            <div className="w-full">
                
                <div className="flex flex-col xl:flex-row items-start">
                    
                    {/* Left/Main Column */}
                    <div className="flex-1 w-full min-w-0 flex flex-col gap-10 transition-all duration-300">
                        
                        {/* Video Player */}
                        <div className="w-full rounded-[24px] overflow-hidden bg-gradient-to-br from-gray-900 via-slate-900 to-black shadow-2xl relative h-[60vh] xl:h-[calc(100vh-48px)] min-h-[500px] flex flex-col justify-end group transition-all duration-300">
                            
                            {/* Back Button Overlay */}
                            <button 
                                onClick={handleBack}
                                className="absolute top-6 left-6 z-30 flex items-center justify-center p-2 rounded-full bg-black/40 border border-white/20 backdrop-blur-md text-white hover:bg-black/60 transition group"
                                aria-label="Back to Roadmap"
                            >
                                <ChevronLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
                            </button>
                            
                            {/* Toggle Button */}
                            <button 
                                onClick={() => setIsChatOpen(!isChatOpen)}
                                className="absolute top-6 right-6 z-30 flex items-center gap-2 px-4 py-2 rounded-full bg-black/40 border border-white/20 backdrop-blur-md text-white text-sm font-semibold hover:bg-black/60 transition"
                            >
                                {isChatOpen ? <PanelRightClose size={18} /> : <MessageSquare size={18} />}
                                {isChatOpen ? 'Focus Mode' : 'AI Chat'}
                            </button>
                            
                            {/* Abstract glow */}
                            <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-brand-500/10 rounded-full blur-[100px] pointer-events-none" />
                            <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-brand-900/20 rounded-full blur-[80px] pointer-events-none" />

                            {/* Central Play Button */}
                            <div className="absolute inset-0 flex items-center justify-center z-10">
                                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 border border-white/20 backdrop-blur-md cursor-pointer transition hover:scale-105 hover:bg-white/20">
                                    <Play fill="white" size={32} className="text-white ml-2" />
                                </div>
                            </div>

                            {/* Controls Bar */}
                            <div className="relative z-20 p-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                                <div className="mb-4 relative w-full h-1.5 rounded-full bg-white/20 cursor-pointer">
                                    <div className="absolute left-0 top-0 h-full w-[45%] rounded-full bg-brand-500 relative">
                                        <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 bg-white rounded-full shadow-md" />
                                    </div>
                                </div>
                                <div className="flex items-center justify-between text-white">
                                    <div className="flex items-center gap-6">
                                        <Pause size={20} className="cursor-pointer hover:text-gray-300 transition" />
                                        <div className="flex items-center gap-2">
                                            <Volume2 size={20} className="cursor-pointer hover:text-gray-300 transition" />
                                            <div className="w-16 h-1 rounded-full bg-white/30 hidden md:block">
                                                <div className="w-2/3 h-full bg-white rounded-full" />
                                            </div>
                                        </div>
                                        <span className="text-sm font-medium text-gray-200">12:34 / 28:50</span>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <Settings size={20} className="cursor-pointer hover:text-gray-300 transition" />
                                        <Maximize size={20} className="cursor-pointer hover:text-gray-300 transition" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Bottom Section (Stacked Vertically under Video) */}
                        <div className="flex flex-col gap-10">
                            
                            {/* Details & Description */}
                            <div className="space-y-8">
                                <div>
                                    <h1 className="text-3xl font-bold text-gray-900">Thiết kế giao diện trong Figma</h1>
                                    <div className="mt-4 flex items-center gap-6">
                                        <div className="flex items-center gap-3">
                                            <img src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=100&q=80" alt="Instructor" className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm" />
                                            <div>
                                                <p className="font-bold text-gray-900">Dr. Sarah Chen</p>
                                                <p className="text-xs text-gray-500">Lead Product Designer</p>
                                            </div>
                                        </div>
                                        <button className="px-5 py-2 bg-gray-900 text-white text-sm font-bold rounded-full hover:bg-gray-800 transition">Theo dõi</button>
                                    </div>
                                </div>
                                
                                <div className="p-6 bg-white rounded-2xl border border-gray-100 shadow-sm text-sm text-gray-600 leading-relaxed space-y-4">
                                    <p>
                                        Chào mừng bạn đến với Module 3! Trong bài học mang tính thực hành cao này, chúng ta sẽ đi sâu vào các tính năng thiết yếu của Figma để tạo ra các bố cục giao diện người dùng chuyên nghiệp. Chúng ta sẽ đề cập đến các nguyên tắc cốt lõi của thiết kế dựa trên component, làm chủ Auto Layout và hệ thống lưới (grid system) responsive.
                                    </p>
                                    <p>
                                        <strong>Những gì bạn sẽ học:</strong>
                                    </p>
                                    <ul className="list-disc pl-5 space-y-2 text-gray-700">
                                        <li>Thiết lập file Design System có khả năng mở rộng</li>
                                        <li>Làm chủ các ràng buộc Auto Layout (Hug, Fill, Fixed)</li>
                                        <li>Tạo các variants tương tác và thuộc tính component</li>
                                        <li>Xuất tài sản (assets) cho developer</li>
                                    </ul>
                                </div>
                            </div>
                            
                            {/* Playlist / Roadmap */}
                            <div className="space-y-6">
                                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                                    <h3 className="font-bold text-gray-900 text-lg mb-6 flex items-center justify-between">
                                        Bài học trong lộ trình
                                        <span className="text-xs font-semibold bg-brand-100 text-brand-600 px-3 py-1 rounded-full">3 / 18</span>
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {[
                                            { title: 'Tư duy thiết kế và nghiên cứu người dùng', duration: '24:10', status: 'completed' },
                                            { title: 'Wireframe và information architecture', duration: '18:45', status: 'completed' },
                                            { title: 'Thiết kế giao diện trong Figma', duration: '28:50', status: 'playing' },
                                            { title: 'Prototype và usability testing', duration: '32:15', status: 'locked' },
                                            { title: 'Bàn giao thiết kế cho Developer', duration: '15:20', status: 'locked' },
                                            { title: 'Thực hành dự án thực tế', duration: '45:00', status: 'locked' }
                                        ].map((item, i) => (
                                            <div key={i} className={`flex gap-4 p-4 rounded-xl transition border ${item.status === 'playing' ? 'bg-brand-50 border-brand-200 shadow-sm' : 'border-gray-100 hover:bg-gray-50 cursor-pointer'}`}>
                                                <div className="mt-0.5 shrink-0">
                                                    {item.status === 'completed' ? (
                                                        <CheckCircle2 size={20} className="text-emerald-500" />
                                                    ) : item.status === 'playing' ? (
                                                        <div className="w-5 h-5 rounded-full bg-brand-100 flex items-center justify-center">
                                                            <div className="w-2.5 h-2.5 rounded-full bg-brand-600 animate-pulse" />
                                                        </div>
                                                    ) : (
                                                        <div className="w-5 h-5 rounded-full border-2 border-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-400">
                                                            {i + 1}
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <h4 className={`text-sm font-semibold ${item.status === 'playing' ? 'text-brand-700' : 'text-gray-800'}`}>{item.title}</h4>
                                                    <p className="text-xs text-gray-500 mt-1">{item.duration}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>

                    {/* Right Column (AI Chatbox) */}
                    <aside className={`relative shrink-0 xl:sticky xl:top-6 h-[60vh] xl:h-[calc(100vh-48px)] min-h-[500px] bg-white rounded-[24px] shadow-sm flex flex-col overflow-hidden transition-all duration-300 ${isChatOpen ? 'w-full xl:w-[400px] opacity-100 border border-gray-100 xl:ml-8 mt-8 xl:mt-0' : 'w-0 opacity-0 border-0 m-0'}`}>
                        <div className="w-full xl:w-[400px] flex flex-col h-full min-h-0 overflow-hidden">
                            <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-3 bg-gradient-to-r from-brand-50 to-white shrink-0">
                            <div className="p-2 bg-brand-100 text-brand-600 rounded-lg">
                                <Sparkles size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900">Orbit AI Assistant</h3>
                                <p className="text-xs text-gray-500">Hỏi đáp trực tiếp về bài học này</p>
                            </div>
                        </div>
                        
                        <div 
                            ref={chatContainerRef}
                            className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-6 pr-2 space-y-6 bg-gray-50/50"
                            onScroll={handleScroll}
                        >
                            {messages.map((msg, idx) => (
                                <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                    {msg.role === 'ai' ? (
                                        <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                                            <Sparkles size={14} className="text-brand-600" />
                                        </div>
                                    ) : (
                                        <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center shrink-0 text-white text-xs font-bold">
                                            GP
                                        </div>
                                    )}
                                    <div className={`${msg.role === 'ai' ? 'bg-white border border-gray-100 text-gray-700 rounded-tl-sm' : 'bg-gray-900 text-white rounded-tr-sm'} p-4 rounded-2xl shadow-sm text-sm leading-relaxed prose prose-sm max-w-none break-words ${msg.role === 'user' ? 'prose-invert text-white' : 'text-gray-700'}`}>
                                        <ReactMarkdown>
                                            {msg.text}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            ))}
                            {isTyping && (
                                <div className="flex gap-4">
                                    <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                                        <Sparkles size={14} className="text-brand-600" />
                                    </div>
                                    <div className="bg-white p-4 rounded-2xl rounded-tl-sm border border-gray-100 shadow-sm text-sm text-gray-500">
                                        <span className="animate-pulse">Đang suy nghĩ...</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {isScrolledUp && (
                            <button 
                                onClick={() => {
                                    setIsScrolledUp(false)
                                    scrollToBottom()
                                }}
                                className="absolute bottom-32 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur shadow-md rounded-full w-8 h-8 flex items-center justify-center text-gray-700 hover:bg-gray-100 transition border border-gray-200 z-10"
                            >
                                {isTyping ? <MoreHorizontal size={16} className="animate-pulse text-brand-500" /> : <ArrowDown size={16} />}
                            </button>
                        )}

                        <div className="p-4 border-t border-gray-100 bg-white shrink-0">
                            <div className="relative">
                                <input 
                                    type="text" 
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                    placeholder="Nhập câu hỏi của bạn..." 
                                    className="w-full bg-gray-50 border border-gray-200 rounded-full pl-5 pr-12 py-3 text-sm outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-100 transition"
                                />
                                <button 
                                    onClick={handleSendMessage}
                                    disabled={isTyping}
                                    className={`absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full ${isTyping ? 'bg-gray-400 cursor-not-allowed' : 'bg-brand-600 hover:bg-brand-700'} text-white transition`}
                                >
                                    <Send size={14} />
                                </button>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                                <span className="text-xs font-semibold px-3 py-1 bg-gray-100 text-gray-600 rounded-full cursor-pointer hover:bg-gray-200 transition">Figma</span>
                                <span className="text-xs font-semibold px-3 py-1 bg-gray-100 text-gray-600 rounded-full cursor-pointer hover:bg-gray-200 transition">UI/UX</span>
                                <span className="text-xs font-semibold px-3 py-1 bg-gray-100 text-gray-600 rounded-full cursor-pointer hover:bg-gray-200 transition">Design System</span>
                            </div>
                            </div>
                        </div>
                    </aside>

                </div>
            </div>
        </main>
    )
}
