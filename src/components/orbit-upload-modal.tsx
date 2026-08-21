'use client'

import { useState } from 'react'
import { ArrowLeft, Check, Play, X } from 'lucide-react'

interface OrbitUploadModalProps {
    onClose: () => void
}

export function OrbitUploadModal({ onClose }: OrbitUploadModalProps) {
    const [caption, setCaption] = useState('')

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="upload-title">
            <div className="flex h-[750px] w-[1100px] max-w-[95vw] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
                <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#e6e7ea] px-6">
                    <button type="button" onClick={onClose} aria-label="Đóng cửa sổ tạo bài viết" className="flex h-10 w-10 items-center justify-center rounded-full text-[#42464e] transition hover:bg-[#f0f1f3]">
                        <ArrowLeft size={24} />
                    </button>
                    <h1 id="upload-title" className="text-lg font-bold text-[#20242c]">Tạo bài viết mới</h1>
                    <button type="button" onClick={onClose} className="text-base font-bold text-[#d9232e] transition hover:text-[#b7131e]">
                        Chia sẻ
                    </button>
                </header>

                <div className="flex min-h-0 flex-1 flex-col md:flex-row">
                    <section className="flex w-full items-center justify-center bg-[#f7f8fa] p-8 md:w-[45%]" aria-label="Video preview">
                        <button type="button" className="group relative flex h-full aspect-[9/16] w-full max-w-[340px] items-center justify-center overflow-hidden rounded-xl bg-[#e8eaed] text-[#777c86] shadow-sm transition hover:bg-[#dfe2e6]" aria-label="Chọn video">
                            <span className="flex flex-col items-center gap-4 text-sm font-medium">
                                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-[#444952] shadow-sm transition group-hover:scale-105">
                                    <Play size={28} fill="currentColor" className="ml-1" />
                                </span>
                                Nhấn để chọn video
                            </span>
                        </button>
                    </section>

                    <section className="flex w-full flex-col overflow-y-auto p-8 md:w-[55%]" aria-label="Post details">
                        <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#202328] text-sm font-bold text-white">GP</div>
                            <span className="text-base font-bold text-[#242832]">Gia Phú</span>
                        </div>
                        
                        <textarea 
                            value={caption} 
                            onChange={(event) => setCaption(event.target.value)} 
                            placeholder="Viết tiêu đề và mô tả..." 
                            className="mt-6 min-h-[160px] w-full resize-none border-0 p-0 text-lg leading-relaxed text-[#444952] outline-none placeholder:text-[#a1a6b0]" 
                        />
                        
                        <div className="mt-8 border-t border-[#ececef] pt-8">
                            <label htmlFor="skill-search" className="text-sm font-bold text-[#30343c]">
                                Gắn thẻ kỹ năng
                            </label>
                            <input 
                                id="skill-search" 
                                placeholder="Tìm kỹ năng..." 
                                className="mt-4 h-12 w-full rounded-xl border border-[#e1e3e7] px-4 text-base text-[#343840] outline-none transition focus:border-[#d9232e] focus:ring-2 focus:ring-[#d9232e]/10" 
                            />
                            
                            <div className="mt-4 flex flex-wrap gap-3">
                                <span className="inline-flex items-center gap-2 rounded-full bg-[#fff0ee] px-4 py-2 text-sm font-semibold text-[#b7131e]">
                                    Photoshop <X size={16} className="cursor-pointer" />
                                </span>
                                <span className="inline-flex items-center gap-2 rounded-full bg-[#f1f2f4] px-4 py-2 text-sm font-semibold text-[#555a64]">
                                    Premiere Pro <X size={16} className="cursor-pointer" />
                                </span>
                                <span className="inline-flex items-center gap-2 rounded-full bg-[#f1f2f4] px-4 py-2 text-sm font-semibold text-[#555a64]">
                                    Motion <X size={16} className="cursor-pointer" />
                                </span>
                            </div>
                        </div>
                        
                        <div className="mt-auto flex items-center gap-2 pt-8 text-sm text-[#9297a1]">
                            <Check size={18} /> Bài viết sẽ xuất hiện trong Discover
                        </div>
                    </section>
                </div>
            </div>
        </div>
    )
}
