import { useMemo } from 'react'
import type { Lesson } from '@/data/types'
import { resolveCourses, resolveLessons, useCatalog, type TeacherCourse } from '@/store/useCatalog'
import { selectSources, useKb, type Reading } from '@/lib/kb/store'
import type { KbSource } from '@/lib/kb/types'

// Kho tài liệu của giảng viên = khóa học (danh mục) + nguồn (kho tri thức). Video là một BÀI GIẢNG của khóa, tài liệu là tài liệu tham khảo.
// Các hàm ở đây giữ hai store khớp nhau (đổi tên, chuyển khóa, xóa video đổi cả bài lẫn nguồn).

export interface LibraryItem {
    source: KbSource
    reading?: Reading
    /** Bài giảng của nguồn video */
    lesson?: Lesson
}

export interface LibraryCourse {
    course: TeacherCourse
    /** Video theo thứ tự bài, rồi tài liệu (mới nhất trước), rồi nguồn đang đọc chưa có trong kho */
    items: LibraryItem[]
}

/** Dữ liệu cổng giảng viên, dựng lại khi danh mục hoặc kho đổi. */
export function useLibrary() {
    const kb = useKb()
    const cat = useCatalog()
    return useMemo(() => {
        const courses = resolveCourses(cat)
        const lessons = resolveLessons(cat)
        const byLesson = new Map(lessons.map((l) => [l.id, l]))
        const sources = selectSources(kb).filter((s) => courses.some((c) => c.id === s.courseId) && (s.kind === 'doc' || (s.lessonId ? byLesson.has(s.lessonId) : true)))
        const live = new Set(sources.map((s) => s.id))
        const groups: LibraryCourse[] = courses.map((course) => {
            const mine = sources.filter((s) => s.courseId === course.id)
            const videos = lessons
                .filter((l) => l.courseId === course.id)
                .flatMap((l) => {
                    const source = mine.find((s) => s.lessonId === l.id)
                    return source ? [{ source, lesson: l, reading: kb.reading[source.id] }] : []
                })
            const docs = mine.filter((s) => s.kind === 'doc').map((source) => ({ source, reading: kb.reading[source.id] }))
            const fresh = Object.values(kb.reading).filter((r) => r.source.courseId === course.id && !live.has(r.source.id)).map((r) => ({ source: r.source, reading: r }))
            return { course, items: [...fresh, ...videos, ...docs] }
        })
        const all = groups.flatMap((g) => g.items)
        return {
            groups,
            courses,
            total: all.length,
            ready: all.filter((i) => !i.reading).length,
            chunks: sources.reduce((a, s) => a + s.chunkCount, 0),
            concepts: sources.reduce((a, s) => a + s.sectionCount, 0),
        }
    }, [kb, cat])
}

export function renameSource(source: KbSource, title: string) {
    const t = title.trim().slice(0, 120)
    if (!t) return
    useKb.getState().rename(source.id, t)
    if (source.lessonId) useCatalog.getState().renameLesson(source.lessonId, t)
}

export function moveSource(source: KbSource, courseId: string) {
    useKb.getState().move(source.id, courseId)
    if (source.lessonId) useCatalog.getState().moveLesson(source.lessonId, courseId)
}

/** Xóa nguồn (xóa video thì bài biến mất ở phía sinh viên). Trả hai hàm: hoàn tác ngay, và chốt khi hết thời gian hoàn tác. */
export function removeSource(source: KbSource) {
    useKb.getState().remove(source.id)
    if (source.lessonId) useCatalog.getState().deleteLesson(source.lessonId)
    return {
        undo: () => {
            useKb.getState().restore(source.id)
            if (source.lessonId) useCatalog.getState().restoreLesson(source.lessonId)
        },
        commit: () => useKb.getState().purge(source.id),
    }
}

/** Xóa mềm cả khóa; hoàn tác trong vài giây. */
export function removeCourse(id: string) {
    useCatalog.getState().deleteCourse(id)
    return { undo: () => useCatalog.getState().restoreCourse(id) }
}

/** Đặt thứ tự các video (bài) của khóa; phía sinh viên đổi theo ngay. */
export function reorderVideos(courseId: string, lessonIds: string[]) {
    useCatalog.getState().setOrder(courseId, lessonIds)
}
