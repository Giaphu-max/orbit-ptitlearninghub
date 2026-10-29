import { Component, type ReactNode } from 'react'

interface Props {
    children: ReactNode
    onBack: () => void
}

/** Chặn lỗi khi dựng khu xem ảnh: hiện thông báo kèm nút quay lại studio thay vì trắng màn. */
export class ViewerBoundary extends Component<Props, { failed: boolean }> {
    state = { failed: false }

    static getDerivedStateFromError() {
        return { failed: true }
    }

    componentDidCatch(error: unknown) {
        console.error('Không mở được ảnh trong khu xem ảnh', error)
    }

    render() {
        if (!this.state.failed) return this.props.children
        return (
            <div role="alert" className="mx-auto mt-10 max-w-md rounded-[20px] border border-border bg-card p-8 text-center shadow-card">
                <p className="text-lg font-extrabold text-strong">Không mở được ảnh này</p>
                <p className="mt-2 text-sm text-muted-foreground">Dữ liệu ảnh hoặc kết quả chấm bị lỗi. Bạn quay lại studio và thử ảnh khác nhé.</p>
                <button
                    type="button"
                    onClick={this.props.onBack}
                    className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-bold text-ink-foreground transition hover:bg-brand-700"
                >
                    Quay lại studio
                </button>
            </div>
        )
    }
}
