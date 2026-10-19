import type { RefObject } from 'react'
import { AlertTriangle, ExternalLink, Film, Loader2 } from 'lucide-react'
import type { PlayerStatus } from '@/hooks/useYouTubePlayer'

interface LessonPlayerProps {
    containerRef: RefObject<HTMLDivElement | null>
    status: PlayerStatus
    error: string | null
    youtubeId: string
}

/** Khung 16:9 chứa iframe YouTube, kèm trạng thái đang tải / lỗi / chưa có video. */
export function LessonPlayer({ containerRef, status, error, youtubeId }: LessonPlayerProps) {
    return (
        <div className="relative aspect-video w-full overflow-hidden rounded-panel bg-ink shadow-raised">
            <div ref={containerRef} className="absolute inset-0 [&_iframe]:h-full [&_iframe]:w-full" />

            {status === 'loading' && (
                <div className="absolute inset-0 flex items-center justify-center text-white/70">
                    <Loader2 className="animate-spin" size={36} aria-label="Đang tải video" />
                </div>
            )}

            {status === 'no-video' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-ink via-ink to-brand-950 px-6 text-center text-white">
                    <Film size={36} className="text-white/60" />
                    <p className="text-lg font-bold">Bài mẫu chưa gắn video</p>
                    <p className="max-w-md text-sm text-white/70">
                        Nội dung thật sẽ được tạo từ video YouTube bằng scripts/generate-content.ts. Bạn vẫn có thể bấm transcript hoặc mốc thời gian để thử.
                    </p>
                </div>
            )}

            {status === 'error' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink px-6 text-center text-white">
                    <AlertTriangle size={36} className="text-warning" />
                    <p className="text-lg font-bold">Chưa phát được video</p>
                    <p className="max-w-md text-sm text-white/70">{error}</p>
                    {youtubeId && (
                        <a
                            href={`https://www.youtube.com/watch?v=${youtubeId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold transition hover:bg-white/20"
                        >
                            Mở trên YouTube <ExternalLink size={14} />
                        </a>
                    )}
                </div>
            )}
        </div>
    )
}
