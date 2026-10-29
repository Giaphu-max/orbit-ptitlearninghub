import { getConcept } from '@/data'

// Đề bài thực hành trong Studio 3D gắn với khái niệm của khóa Nhiếp ảnh và ánh sáng.
// `lighting` là mô tả ánh sáng gửi cho Prompt-to-Environment (tiếng Việt, tối đa 200 ký tự).

export interface StudioBrief {
    conceptId: string
    /** Tên ngắn hiển thị trên header studio (vd: "Chân dung ở giao điểm 1/3") */
    shortTitle: string
    /** Việc sinh viên cần làm trong Studio */
    task: string
    /** Mô tả ánh sáng gợi ý để AI bố trí đèn */
    lighting: string
    /** Tiêu chí bố cục cho chip header */
    compositionCriterion?: string
    /** Tiêu chí ánh sáng cho chip header */
    lightingCriterion?: string
    /** Điểm đạt tối thiểu */
    targetScore?: number
}

export const DEFAULT_SHORT_TITLE = 'Chân dung ở giao điểm 1/3'
export const DEFAULT_BRIEF = 'Chụp chân dung với chủ thể ở giao điểm một phần ba, ánh sáng đúng ý đồ bạn chọn (tự chỉnh đèn hoặc mô tả bằng lời).'

export const STUDIO_BRIEFS: StudioBrief[] = [
    {
        conceptId: 'key-light',
        shortTitle: 'Đèn chính tạo khối',
        task: 'Chỉ dùng đèn chính để tạo hướng và bóng đổ rõ cho chủ thể; hạ đèn phụ và đèn viền về gần 0.',
        lighting: 'Một đèn chính mạnh chếch 45 độ, đèn phụ và đèn viền gần như tắt, bóng đổ rõ để thấy hướng sáng',
        compositionCriterion: 'Bố cục 1/3',
        lightingCriterion: 'Đèn chính rõ hướng',
    },
    {
        conceptId: 'fill-light',
        shortTitle: 'Đèn phụ làm mềm bóng',
        task: 'Giữ đèn chính, thêm đèn phụ ở phía đối diện để bóng mềm đi. So sánh ảnh khi đèn phụ yếu và khi mạnh.',
        lighting: 'Ánh sáng chân dung mềm, đèn chính vừa phải, đèn phụ mạnh phía đối diện để bóng không gắt',
        compositionCriterion: 'Bố cục 1/3',
        lightingCriterion: 'Bóng mềm tự nhiên',
    },
    {
        conceptId: 'back-light',
        shortTitle: 'Đèn viền tách phông',
        task: 'Dùng đèn viền phía sau để tạo đường sáng quanh chủ thể, tách khỏi phông tối.',
        lighting: 'Đèn viền mạnh phía sau chủ thể tạo đường sáng quanh vai và đầu, phông tối, đèn chính dịu',
        compositionCriterion: 'Bố cục 1/3',
        lightingCriterion: 'Đèn viền tách phông',
    },
    {
        conceptId: 'practical-light',
        shortTitle: 'Nguồn sáng thực tế',
        task: 'Tạo cảm giác có một nguồn sáng thật trong cảnh (như đèn bàn) cho hậu cảnh thêm chiều sâu.',
        lighting: 'Cảnh trong nhà buổi tối ấm áp như có đèn bàn vàng trong khung, đèn chính dịu, phông tối nhẹ',
        compositionCriterion: 'Bố cục 1/3',
        lightingCriterion: 'Nguồn sáng thực tế',
    },
    {
        conceptId: 'cac-thuat-ngu-mau-sac',
        shortTitle: 'Nhiệt độ màu & Cảm xúc',
        task: 'Thử nhiệt độ màu: làm một ảnh ấm (vàng cam) và một ảnh lạnh (xanh), chủ thể và bố cục giữ nguyên.',
        lighting: 'Ánh sáng nhiệt độ màu ấm vàng cam, bão hòa vừa, dịu như giờ vàng',
        compositionCriterion: 'Bố cục 1/3',
        lightingCriterion: 'Nhiệt độ màu chuẩn',
    },
    {
        conceptId: 'tam-ly-hoc-mau-sac',
        shortTitle: 'Tâm lý học màu sắc',
        task: 'Chọn màu ánh sáng để kể một cảm xúc: ấm áp, bình yên hay lạnh lẽo, cô đơn. Giải thích lựa chọn của bạn.',
        lighting: 'Ánh sáng xanh lạnh buổi đêm gợi cảm giác cô đơn, đèn chính yếu, có chút sương',
        compositionCriterion: 'Bố cục 1/3',
        lightingCriterion: 'Màu sắc cảm xúc',
    },
    {
        conceptId: 'phoi-hop-mau-sac',
        shortTitle: 'Phối màu ánh sáng',
        task: 'Phối màu bổ túc: ánh sáng chủ thể một màu, phông và đèn phụ màu đối diện trên vòng tròn màu.',
        lighting: 'Đèn chính màu cam ấm, đèn phụ và phông xanh lam đối lập, tạo cặp màu bổ túc rõ rệt',
        compositionCriterion: 'Bố cục 1/3',
        lightingCriterion: 'Màu sắc bổ túc',
    },
    {
        conceptId: 'ngon-ngu-thi-giac-dien-anh',
        shortTitle: 'Khung hình điện ảnh',
        task: 'Tạo khung hình điện ảnh: tương phản mạnh, chủ thể đặt lệch ở giao điểm một phần ba, tiêu cự dài.',
        lighting: 'Ánh sáng điện ảnh tương phản cao, đèn chính cạnh bên thấp, bóng sâu, không khí kịch tính',
        compositionCriterion: 'Bố cục 1/3',
        lightingCriterion: 'Tương phản điện ảnh',
    },
]

export const getStudioBrief = (conceptId: string | null | undefined) => STUDIO_BRIEFS.find((b) => b.conceptId === conceptId)

/** Đề bài kèm tên khái niệm, bỏ đề bài có khái niệm không còn trong dữ liệu. */
export const studioBriefsWithConcept = () =>
    STUDIO_BRIEFS.flatMap((b) => {
        const concept = getConcept(b.conceptId)
        return concept ? [{ ...b, conceptName: concept.name }] : []
    })
