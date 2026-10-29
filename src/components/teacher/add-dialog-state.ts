import { create } from 'zustand'

/** Trạng thái hộp "Thêm bài giảng từ YouTube": mở từ thanh bên, trang Bài giảng, Tổng quan; hộp dựng một lần trong TeacherShell. */
interface AddDialogState {
    open: { courseId?: string } | null
    show: (courseId?: string) => void
    hide: () => void
}

export const useAddDialog = create<AddDialogState>((set) => ({
    open: null,
    show: (courseId) => set({ open: { courseId } }),
    hide: () => set({ open: null }),
}))
