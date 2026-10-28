import { useState } from 'react'
import './course-map.css'

// Thumbnail YouTube: thử độ phân giải cao nhất trước; maxres không có thì YouTube trả ảnh xám 120×90, khi đó lùi về sd rồi hq.
const THUMB_STEPS = ['maxresdefault', 'sddefault', 'hqdefault'] as const

/** Ảnh thumbnail bài giảng (lazy, fade-in 250ms); trong lúc chờ hoặc khi lỗi hết thì lộ nền gradient của khung cha. */
export function Thumb({ youtubeId, className = '' }: { youtubeId: string; className?: string }) {
    return <ThumbImg key={youtubeId} youtubeId={youtubeId} className={className} />
}

function ThumbImg({ youtubeId, className }: { youtubeId: string; className: string }) {
    const [step, setStep] = useState(0)
    const [loaded, setLoaded] = useState(false)
    const [failed, setFailed] = useState(false)
    const next = () => (step < THUMB_STEPS.length - 1 ? setStep(step + 1) : setFailed(true))
    if (failed) return null
    return (
        <img
            key={step}
            src={`https://i.ytimg.com/vi/${youtubeId}/${THUMB_STEPS[step]}.jpg`}
            alt=""
            loading="lazy"
            onLoad={(e) => (e.currentTarget.naturalWidth <= 120 && step < THUMB_STEPS.length - 1 ? next() : setLoaded(true))}
            onError={next}
            // hqdefault/sddefault có viền đen trên dưới: phóng nhẹ để cắt; maxres là 16:9 nguyên bản
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[250ms] ${step > 0 ? 'cm-img' : ''} ${loaded ? 'opacity-100' : 'opacity-0'} ${className}`}
        />
    )
}

/** Gradient dự phòng: màu nhấn môn pha với nền tối cố định. */
export const FALLBACK_BG = 'linear-gradient(135deg, hsl(var(--subject) / 0.55), hsl(var(--ink)))'
