const FLAME_PATH =
    'M12 2c.6 3.2 2.6 5.3 4.4 7.3C18.2 11.3 20 13.4 20 16.2 20 20 16.4 23 12 23s-8-3-8-6.8c0-2.3 1.1-4 2.5-5.4.3 1.6 1.3 2.8 2.7 3.2-.6-3.8.9-7.6 2.8-11z'

/**
 * Ngọn lửa chuỗi ngày: lớp ngoài đỏ "thở" quanh đáy, lõi vàng liếm, quầng đỏ mờ dưới chân (index.css, .flame).
 * Chuỗi 0: lửa xám đứng yên. Chỉ animate transform / opacity, tắt theo prefers-reduced-motion.
 */
export function StreakFlame({ lit }: { lit: boolean }) {
    return (
        <span className={`flame ${lit ? 'is-lit' : ''}`} aria-hidden="true">
            <svg viewBox="0 0 24 24">
                <path className="flame-outer" d={FLAME_PATH} />
                {lit && <path className="flame-inner" d={FLAME_PATH} />}
            </svg>
        </span>
    )
}
