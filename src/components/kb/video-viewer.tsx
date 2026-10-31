import { Play } from 'lucide-react'
import type { Lesson } from '@/data/types'
import type { KbSource } from '@/lib/kb/types'
import { mmss } from '@/lib/kb/ask'
import { Modal } from './modal'

/** Xem video bài giảng ở cổng giảng viên: phát video + danh sách khái niệm và câu hỏi AI đã tạo (chỉ xem). */
export function VideoViewer({ source, lesson, onClose }: { source: KbSource; lesson?: Lesson; onClose: () => void }) {
    return (
        <Modal title={source.title} onClose={onClose} width={860}>
            {!lesson ? (
                <p className="mt-4 text-sm text-muted-foreground">Không tìm thấy nội dung bài giảng của video này.</p>
            ) : (
                <div className="mt-4 grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-5 max-md:grid-cols-1">
                    <div>
                        <div className="aspect-video overflow-hidden rounded-2xl bg-ink">
                            <iframe title={lesson.title} src={`https://www.youtube-nocookie.com/embed/${lesson.youtubeId}?rel=0`} allow="encrypted-media; picture-in-picture" allowFullScreen className="h-full w-full border-0" />
                        </div>
                        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{lesson.summary}</p>
                        <p className="mt-2 font-mono text-xs text-muted-foreground">
                            {mmss(lesson.durationSec)} · {lesson.transcript.length} dòng phụ đề · AI đã tách {source.chunkCount} đoạn
                        </p>
                    </div>
                    <div className="max-h-[60svh] overflow-y-auto pr-1">
                        <h3 className="text-sm font-black text-strong">Khái niệm AI đã tạo ({lesson.concepts.length})</h3>
                        <ul className="mt-2 space-y-2">
                            {lesson.concepts.map((c) => (
                                <li key={c.id} className="rounded-xl bg-muted px-3 py-2.5 text-[13px]">
                                    <b className="block text-strong">{c.name}</b>
                                    <span className="mt-0.5 block text-muted-foreground">{c.definition}</span>
                                    <span className="mt-1 inline-flex items-center gap-1 font-mono text-[11.5px] text-brand-ink">
                                        <Play size={9} className="fill-current" aria-hidden /> {mmss(c.segment.start)}–{mmss(c.segment.end)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                        <h3 className="mt-4 text-sm font-black text-strong">Câu hỏi dừng video ({lesson.quiz.length})</h3>
                        <ul className="mt-2 space-y-2">
                            {lesson.quiz.map((q) => (
                                <li key={q.id} className="rounded-xl bg-muted px-3 py-2.5 text-[13px]">
                                    <span className="font-mono text-[11.5px] text-brand-ink">{mmss(q.pauseAt)}</span> <span className="text-foreground">{q.prompt}</span>
                                    <span className="mt-0.5 block text-xs text-muted-foreground">{q.variants.length} câu biến thể</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </Modal>
    )
}
