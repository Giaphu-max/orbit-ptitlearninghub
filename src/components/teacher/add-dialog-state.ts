import { create } from 'zustand'

/** Trạng thái hộp "Thêm bài giảng từ YouTube": mở từ thanh bên, trang Bài giảng, Tổng quan; hộp dựng một lần trong TeacherShell. */
interface AddDialogState {
    open: { courseId?: string; replaceId?: string } | null
    show: (courseId?: string) => void
    /** Mở ở chế độ thay video cho một bài đã có */
    replace: (lessonId: string) => void
    hide: () => void
}

export const useAddDialog = create<AddDialogState>((set) => ({
    open: null,
    show: (courseId) => set({ open: { courseId } }),
    replace: (replaceId) => set({ open: { replaceId } }),
    hide: () => set({ open: null }),
}))
