// Chuẩn hóa tiếng Việt cho truy hồi: bỏ dấu (NFD), chữ thường, tách âm tiết.

export function fold(s: string): string {
    return s
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'd')
        .toLowerCase()
}

/** Stopword tiếng Việt cơ bản (đã bỏ dấu). */
const STOP = new Set(
    'la va cua cho co khong nhung cac mot nhu the nao gi sao dau duoc de khi ma thi se da dang rat cung voi tu den trong ngoai o tai nay hom ngay do kia ay nao ai bao nhieu hay hoac neu thi vi nen boi vay thoi roi nua con lai ra vao len xuong qua theo tren duoi giua truoc sau minh toi ban em anh chi thay co hoi cau tra loi giai thich noi dung bai'.split(' '),
)

export function tokens(s: string): string[] {
    return fold(s)
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length > 0 && !STOP.has(t))
}

/** Âm tiết + cặp âm tiết liền kề (gần với "từ" tiếng Việt): bigram nặng điểm hơn khi khớp. */
export function terms(s: string): string[] {
    const uni = fold(s)
        .split(/[^a-z0-9]+/)
        .filter(Boolean)
    const out: string[] = []
    for (let i = 0; i < uni.length; i++) {
        // Âm tiết 1–2 chữ cái ("an", "ca", "co"…) khớp với quá nhiều từ không liên quan nên không tính riêng
        if (!STOP.has(uni[i]) && (uni[i].length >= 3 || /\d/.test(uni[i]))) out.push(uni[i])
        if (i + 1 < uni.length && !(STOP.has(uni[i]) && STOP.has(uni[i + 1]))) out.push(`${uni[i]}_${uni[i + 1]}`)
    }
    return out
}
