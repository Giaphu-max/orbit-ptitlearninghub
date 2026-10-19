import { Link } from 'react-router-dom'
import { Box } from 'lucide-react'

/** Studio 3D (Virtual Director) chưa dựng: trang giữ chỗ để mục điều hướng không dẫn tới ngõ cụt. */
export function OrbitStudioView() {
    return (
        <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
                <Box size={30} />
            </span>
            <p className="text-eyebrow uppercase text-brand-ink">Sắp ra mắt</p>
            <h1 className="text-headline text-foreground">Studio 3D</h1>
            <p className="max-w-md text-muted-foreground">
                Chỉnh tiêu cự, góc máy và đèn trong một studio ảo, chụp lại và nhận nhận xét bố cục, ánh sáng từ AI.
            </p>
            <Link to="/" className="mt-2 rounded-full bg-brand-600 px-6 py-3 text-sm font-bold text-ink-foreground shadow-brand transition hover:bg-brand-700">
                Về trang chủ
            </Link>
        </div>
    )
}
