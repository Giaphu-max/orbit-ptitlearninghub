import { lessons } from '@/data'
import { introPlaying, introReady, playRoleIntro, type IntroInfo } from '@/lib/role-intro'
import { preloadHome } from '@/lib/preload'
import { useOrbitStore, type Role } from '@/store/useOrbitStore'

// Chọn / đổi vai trò có màn intro PTIT (lib/role-intro.ts). Đổi vai và chuyển về trang chủ diễn ra phía sau màn đỏ;
// khi màn mở, trang chủ trồi lên lần lượt (class role-entering, index.css).

/** Nội dung intro theo vai trò: lời chào + dòng cá nhân hóa lấy từ store (bài đang học dở / số bài chờ duyệt). */
export function introInfo(role: Role): IntroInfo {
    const st = useOrbitStore.getState()
    if (role === 'teacher') {
        // Bài chưa xuất bản (bản nháp) là nội dung AI đang chờ giảng viên duyệt
        const pending = lessons.filter((l) => (st.lessonReview[l.id] ?? l.status) !== 'published').length
        return {
            words: [{ text: 'Chào' }, { text: 'thầy/cô', name: true }],
            chip: 'Giảng viên',
            pre: pending > 0 ? 'Có ' : 'Mọi ',
            strong: pending > 0 ? `${pending} nội dung AI` : 'nội dung AI',
            post: pending > 0 ? ' đang chờ thầy cô duyệt' : ' đã được thầy cô duyệt',
            loadText: 'Đang mở trang giảng viên',
        }
    }
    const published = lessons.filter((l) => (st.lessonReview[l.id] ?? l.status) === 'published')
    const started = published.some((l) => st.lessonProgress[l.id])
    const resume = published.find((l) => st.lessonProgress[l.id] && !st.lessonProgress[l.id].completed) ?? published.find((l) => !st.lessonProgress[l.id]?.completed) ?? published[0]
    return {
        words: [{ text: 'Chào' }, { text: st.learnerName, name: true }],
        chip: 'Sinh viên · Đa phương tiện',
        pre: started && resume ? 'Học tiếp ' : '',
        strong: started && resume ? resume.title : 'Bắt đầu bài đầu tiên',
        post: ' nhé',
        loadText: 'Đang mở lớp học của bạn',
    }
}

const RISE_MS = 2000

export interface EnterRoleOptions {
    /** Tâm màn đỏ: giữa thẻ/nút vừa bấm */
    origin: { x: number; y: number }
    navigate: (to: string) => void
}

export async function enterRole(role: Role, { origin, navigate }: EnterRoleOptions) {
    if (introPlaying()) return
    // Cảnh 3D tải song song với intro để lúc màn đỏ mở là đã có hình
    preloadHome()
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const swap = () => {
        useOrbitStore.getState().setRole(role)
        navigate('/')
        // Có intro che phía trước thì trang mở thẳng ở trạng thái cuối (không chạy hiệu ứng trồi lên bên dưới)
        if (!reduce && !introReady()) {
            const root = document.documentElement
            root.classList.add('role-entering')
            window.setTimeout(() => root.classList.remove('role-entering'), RISE_MS)
        }
    }
    if (!introReady()) {
        swap()
        return
    }
    await playRoleIntro(origin, introInfo(role), { swap })
}

/** Tâm của một phần tử trên màn hình, dùng làm gốc của màn đỏ. */
export const centerOf = (el: Element) => {
    const r = el.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}
