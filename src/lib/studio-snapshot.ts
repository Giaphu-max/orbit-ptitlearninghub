import type { StudioShot } from '@/store/useStudioSession'

// Snapshot thiết lập lúc chụp: danh sách dòng để hiển thị gọn và so sánh hai ảnh.

export interface SnapshotRow {
    key: string
    label: string
    group: 'camera' | 'light' | 'env'
    /** Giá trị đã định dạng, dùng để hiển thị và để so sánh */
    value: string
}

const pct = (v: number) => `${Math.round(v * 100)}%`

export function snapshotRows(shot: Pick<StudioShot, 'setup' | 'intent'>): SnapshotRow[] {
    const s = shot.setup
    const rows: SnapshotRow[] = [
        { key: 'focal', label: 'Tiêu cự', group: 'camera', value: `${s.focalLengthMm}mm` },
        { key: 'az', label: 'Xoay', group: 'camera', value: `${s.azimuthDeg}°` },
        { key: 'el', label: 'Độ cao máy', group: 'camera', value: `${s.elevationDeg}°` },
        { key: 'dist', label: 'Khoảng cách', group: 'camera', value: `${s.distance.toFixed(1)}m` },
        { key: 'sx', label: 'Dịch khung ngang', group: 'camera', value: pct(s.shiftX) },
        { key: 'sy', label: 'Dịch khung dọc', group: 'camera', value: pct(s.shiftY) },
        { key: 'key', label: 'Đèn chính', group: 'light', value: `${s.key}%` },
        { key: 'kang', label: 'Góc đèn chính', group: 'light', value: `${s.keyAngleDeg}°` },
        { key: 'fill', label: 'Đèn phụ', group: 'light', value: `${s.fill}%` },
        { key: 'rim', label: 'Đèn viền', group: 'light', value: `${s.rim}%` },
    ]
    rows.push({ key: 'env', label: 'Môi trường AI', group: 'env', value: shot.intent.prompt ?? 'Không dùng' })
    return rows
}

/** Các thông số khác nhau giữa hai ảnh, dạng "Đèn viền 0% → 40%". */
export function diffRows(a: StudioShot, b: StudioShot) {
    const rb = snapshotRows(b)
    return snapshotRows(a).flatMap((r, i) => (r.value !== rb[i].value ? [{ label: r.label, from: r.value, to: rb[i].value }] : []))
}
