import type { TranscriptSegment } from './types'

/**
 * Transcript mẫu cho "video tải lên" ở cổng giảng viên (bản demo không xử lý file video thật):
 * video tải lên được giả lập bằng bản phụ đề này.
 */
export const DEMO_VIDEO = {
    title: 'Bài giảng: Âm thanh và nhịp trong dựng phim',
    durationSec: 492,
}

export const DEMO_VIDEO_TRANSCRIPT: TranscriptSegment[] = [
    { start: 0, end: 38, text: 'Trong dựng phim, âm thanh quyết định một nửa cảm xúc của người xem. Hình ảnh cho người xem biết chuyện gì đang xảy ra, còn âm thanh cho họ biết nên cảm thấy thế nào về điều đó.' },
    { start: 38, end: 85, text: 'Âm thanh trong một bản dựng thường chia thành bốn nhóm: lời thoại, nhạc, hiệu ứng âm thanh và âm nền. Mỗi nhóm nằm trên các track riêng để có thể chỉnh âm lượng độc lập với nhau.' },
    { start: 85, end: 132, text: 'Lời thoại là nhóm quan trọng nhất, luôn phải nghe rõ. Khi trộn âm, mức lời thoại được đặt làm chuẩn, nhạc và hiệu ứng được hạ xuống để không che mất lời nói.' },
    { start: 132, end: 178, text: 'Âm nền, còn gọi là room tone, là tiếng không khí của không gian quay. Mỗi cảnh nên thu vài chục giây room tone để lấp những khoảng lặng giữa các đoạn thoại, tránh cảm giác âm thanh bị đứt.' },
    { start: 178, end: 226, text: 'Hiệu ứng âm thanh, hay foley và SFX, làm cho thế giới trong phim có thật hơn: tiếng bước chân, tiếng cửa, tiếng vải cọ. Chúng được thêm vào sau, khớp với từng hành động trên hình.' },
    { start: 226, end: 275, text: 'Nhạc phim dẫn dắt cảm xúc và nhịp của cảnh. Điểm cắt hình thường được đặt trùng với nhịp mạnh của nhạc để người xem cảm thấy bản dựng liền mạch.' },
    { start: 275, end: 322, text: 'Kỹ thuật J-cut là cho âm thanh của cảnh tiếp theo vào trước khi hình đổi. Ngược lại, L-cut là giữ âm thanh của cảnh trước chạy tiếp sang cảnh sau. Cả hai giúp chuyển cảnh mềm và tự nhiên hơn.' },
    { start: 322, end: 370, text: 'Khi trộn âm, cần để ý đỉnh âm lượng. Âm thanh vượt quá mức tối đa sẽ bị vỡ tiếng, nên người dựng theo dõi đồng hồ đo và giữ đỉnh dưới mức giới hạn của chuẩn phát hành.' },
    { start: 370, end: 420, text: 'Một mẹo nhỏ là nghe thử bản dựng ở nhiều thiết bị khác nhau, từ tai nghe tới loa điện thoại, để chắc chắn lời thoại vẫn rõ trên mọi thiết bị người xem dùng.' },
    { start: 420, end: 492, text: 'Tóm lại, hãy xử lý âm thanh như xử lý hình: có kế hoạch, tách lớp rõ ràng, và luôn lấy người xem làm chuẩn. Âm thanh tốt là âm thanh mà người xem không nhận ra, nhưng sẽ nhận ra ngay khi nó thiếu.' },
]
