/** Nền chế độ tập trung (giao diện sáng): họa tiết đỏ thưa gợi vầng quỹ đạo logo PTIT, cố định phía sau, không bắt chuột. */
export function FocusBackdrop() {
    const brand = (a: number) => `hsl(var(--brand) / ${a})`
    return (
        <div aria-hidden className="lesson-focus-bg">
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
                <defs>
                    <pattern id="focus-dots" width="28" height="28" patternUnits="userSpaceOnUse">
                        <circle cx="2" cy="2" r="1.2" fill="hsl(var(--foreground-strong) / 0.06)" />
                    </pattern>
                </defs>
                <rect width="1440" height="900" fill="url(#focus-dots)" />
                {/* Quỹ đạo: trên trái và dưới phải, bị mép màn cắt */}
                <g transform="translate(150 110) rotate(-24)">
                    <ellipse className="focus-orbit-spin" cx="0" cy="0" rx="560" ry="200" fill="none" stroke={brand(0.2)} strokeWidth="1.5" />
                </g>
                <g transform="translate(1300 800) rotate(-24)">
                    <ellipse className="focus-orbit-spin" cx="0" cy="0" rx="520" ry="190" fill="none" stroke={brand(0.18)} strokeWidth="1.5" />
                </g>
                {/* Chấm và ô vuông nhỏ ở lề */}
                <circle cx="96" cy="430" r="4" fill={brand(0.35)} />
                <rect x="52" y="690" width="9" height="9" rx="1.5" fill={brand(0.3)} />
                <circle cx="210" cy="820" r="3" fill={brand(0.32)} />
                <rect x="1360" y="190" width="10" height="10" rx="1.5" fill={brand(0.35)} />
                <circle cx="1392" cy="470" r="4" fill={brand(0.3)} />
                <rect x="1250" y="70" width="7" height="7" rx="1.5" fill={brand(0.32)} />
                <circle cx="760" cy="860" r="3" fill={brand(0.3)} />
            </svg>
            <div className="absolute left-1/2 top-1/2 h-[80vh] w-[80vw] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(closest-side,hsl(var(--brand)/0.06),transparent)]" />
        </div>
    )
}
