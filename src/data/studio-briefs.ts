import type { StudioBrief, StudioRubricCriterion } from './types'

// Đề thực hành Studio 3D gắn với khóa Nhiếp ảnh và ánh sáng. Mỗi đề là một "brief": ý đồ (goal) + rubric định tính tổng 100 điểm.
// Rubric chỉ nói điều ảnh cần truyền tải; `hint` là một cách đạt, không phải yêu cầu thông số.

const PASS = 70

const composition = (points: number, description: string, hint: string): StudioRubricCriterion => ({ key: 'composition', label: 'Bố cục', points, description, hint })
const lighting = (points: number, description: string, hint: string): StudioRubricCriterion => ({ key: 'lighting', label: 'Ánh sáng', points, description, hint })
const intent = (points: number, description: string, hint: string): StudioRubricCriterion => ({ key: 'intent', label: 'Ý đồ', points, description, hint })

export const STUDIO_BRIEFS: StudioBrief[] = [
    {
        id: 'den-chinh-tao-khoi',
        shortTitle: 'Đèn chính tạo khối',
        goal: 'Dùng một đèn chính mạnh để tạo khối và hướng sáng rõ cho chủ thể.',
        difficulty: 1,
        conceptIds: ['key-light'],
        thumbnail: { tone: 'orange' },
        passScore: PASS,
        rubric: [
            composition(25, 'Chủ thể là điểm nhìn đầu tiên, còn khoảng thở và không bị cắt cụt.', 'Thử đặt chủ thể gần một giao điểm 1/3 trên lưới.'),
            lighting(50, 'Nhìn là biết ánh sáng đến từ đâu; bóng đổ tạo được khối cho chủ thể mà vẫn đọc được chi tiết.', 'Đèn chính chếch khoảng 45° và hạ bớt đèn phụ thường cho bóng rõ hơn.'),
            intent(25, 'Cả bức ảnh phục vụ một cảm giác nhất quán về hướng và độ gắt của ánh sáng.', 'Chọn trước muốn ánh sáng gắt hay dịu rồi giữ nhất quán.'),
        ],
    },
    {
        id: 'den-phu-lam-mem-bong',
        shortTitle: 'Đèn phụ làm mềm bóng',
        goal: 'Làm mềm bóng đổ bằng ánh sáng phụ mà vẫn giữ được khối của khuôn mặt.',
        difficulty: 1,
        conceptIds: ['fill-light'],
        thumbnail: { tone: 'sky' },
        passScore: PASS,
        rubric: [
            composition(25, 'Chủ thể rõ ràng, khung hình gọn, không bị cắt cụt.', 'Thử đặt chủ thể gần giao điểm 1/3.'),
            lighting(50, 'Vùng tối không bị đen kịt nhưng ảnh vẫn còn chiều sâu, không bị phẳng.', 'Một đèn phụ ở phía đối diện đèn chính, yếu hơn, thường đủ làm dịu bóng.'),
            intent(25, 'Cảm giác chung dịu và tự nhiên, như ánh sáng chân dung mềm.', 'So sánh ảnh khi đèn phụ yếu và khi mạnh để chọn mức bạn thấy hợp.'),
        ],
    },
    {
        id: 'den-vien-tach-phong',
        shortTitle: 'Đèn viền tách phông',
        goal: 'Tạo một đường sáng quanh vai và đầu để tách chủ thể khỏi phông tối.',
        difficulty: 2,
        conceptIds: ['back-light'],
        thumbnail: { tone: 'pink' },
        passScore: PASS,
        rubric: [
            composition(25, 'Chủ thể nổi bật trên phông, khoảng cách tới phông đủ để thấy sự tách biệt.', 'Thử nới khoảng cách hoặc dịch khung để đường viền không dính vào mép.'),
            lighting(50, 'Đường sáng quanh chủ thể rõ nhưng không cháy; mặt chủ thể vẫn đọc được.', 'Đèn viền từ phía sau, chếch lên, kèm đèn chính dịu.'),
            intent(25, 'Cảm giác chiều sâu: chủ thể và phông thuộc hai lớp khác nhau.', 'Phông tối hơn chủ thể sẽ làm viền sáng nổi bật.'),
        ],
    },
    {
        id: 'nguon-sang-thuc-te',
        shortTitle: 'Nguồn sáng thực tế',
        goal: 'Gợi cảm giác có một nguồn sáng thật trong cảnh, như đèn bàn, cho hậu cảnh thêm chiều sâu.',
        difficulty: 2,
        conceptIds: ['practical-light'],
        thumbnail: { tone: 'yellow' },
        passScore: PASS,
        rubric: [
            composition(25, 'Khung hình có chỗ cho nguồn sáng "trong cảnh" mà chủ thể vẫn là trung tâm.', 'Thử dịch khung để có khoảng trống phía nguồn sáng.'),
            lighting(40, 'Người xem tin rằng ánh sáng ấm đến từ một vật dụng trong cảnh; đèn chính dịu, không lấn át.', 'Màu ấm vàng và cường độ vừa phải giúp tạo cảm giác đèn bàn.'),
            intent(35, 'Không khí của căn phòng buổi tối ấm áp, có chiều sâu hậu cảnh.', 'Phông tối nhẹ và một chút sương làm hậu cảnh sâu hơn.'),
        ],
    },
    {
        id: 'nhiet-do-mau-va-cam-xuc',
        shortTitle: 'Nhiệt độ màu & cảm xúc',
        goal: 'Làm bức ảnh ấm áp như giờ vàng bằng nhiệt độ màu của ánh sáng.',
        difficulty: 2,
        conceptIds: ['cac-thuat-ngu-mau-sac'],
        thumbnail: { tone: 'orange' },
        passScore: PASS,
        rubric: [
            composition(20, 'Khung hình gọn, chủ thể rõ; bố cục không bị màu sắc lấn át.', 'Giữ nguyên bố cục để chỉ so sánh sự khác biệt về màu.'),
            lighting(45, 'Gam màu của cả ảnh nghiêng về một nhiệt độ rõ ràng, da và vật thể không bị ám màu quá đà.', 'Ánh sáng vàng cam, bão hòa vừa phải thường gợi giờ vàng.'),
            intent(35, 'Người xem cảm nhận được sự ấm áp, dễ chịu ngay từ cái nhìn đầu tiên.', 'Thử làm thêm một ảnh lạnh để thấy rõ sự khác biệt cảm xúc.'),
        ],
    },
    {
        id: 'tam-ly-hoc-mau-sac',
        shortTitle: 'Tâm lý học màu sắc',
        goal: 'Chọn màu ánh sáng để kể một cảm xúc rõ ràng: cô đơn, bình yên hoặc ấm áp.',
        difficulty: 2,
        conceptIds: ['tam-ly-hoc-mau-sac'],
        thumbnail: { tone: 'blue' },
        passScore: PASS,
        rubric: [
            composition(20, 'Bố cục hỗ trợ cảm xúc: khoảng trống, vị trí chủ thể góp phần kể chuyện.', 'Chủ thể nhỏ trong khung rộng thường gợi sự cô đơn.'),
            lighting(30, 'Màu và độ sáng phù hợp với cảm xúc đã chọn, chủ thể vẫn đọc được.', 'Xanh lạnh, đèn chính yếu, có chút sương hợp với cảnh đêm cô đơn.'),
            intent(50, 'Người xem gọi tên được cảm xúc mà không cần chú thích.', 'Nghĩ trước câu chuyện bạn muốn kể bằng một câu ngắn rồi dựng theo.'),
        ],
    },
    {
        id: 'phoi-mau-anh-sang',
        shortTitle: 'Phối màu ánh sáng',
        goal: 'Phối hai màu đối lập trên vòng tròn màu giữa chủ thể và phông.',
        difficulty: 3,
        conceptIds: ['phoi-hop-mau-sac'],
        thumbnail: { tone: 'teal' },
        passScore: PASS,
        rubric: [
            composition(20, 'Chủ thể và phông tách bạch bằng màu, bố cục không rối.', 'Thử đặt chủ thể gần giao điểm 1/3 để vùng màu của phông có chỗ.'),
            lighting(40, 'Hai màu đối lập hiện rõ và cân bằng, không màu nào nuốt mất màu còn lại.', 'Đèn chính cam ấm kết hợp phông hoặc đèn phụ xanh lam là một cặp bổ túc.'),
            intent(40, 'Cặp màu tạo điểm nhấn thị giác mạnh và có chủ đích.', 'Giảm bão hòa một bên nếu hai màu tranh nhau.'),
        ],
    },
    {
        id: 'khung-hinh-dien-anh',
        shortTitle: 'Khung hình điện ảnh',
        goal: 'Dựng một khung hình điện ảnh: tương phản mạnh, chủ thể lệch về giao điểm một phần ba.',
        difficulty: 3,
        conceptIds: ['ngon-ngu-thi-giac-dien-anh'],
        thumbnail: { tone: 'red' },
        passScore: PASS,
        rubric: [
            composition(35, 'Khung hình có chủ ý như một cảnh phim: chủ thể lệch tâm, có khoảng thở theo hướng nhìn.', 'Tiêu cự dài và chủ thể ở giao điểm 1/3 thường cho cảm giác điện ảnh.'),
            lighting(40, 'Tương phản cao, bóng sâu nhưng chủ thể vẫn đọc được, không bị phẳng.', 'Đèn chính cạnh bên và thấp, đèn phụ gần như tắt.'),
            intent(25, 'Không khí kịch tính nhất quán từ ánh sáng đến bố cục.', 'Chọn một tâm trạng (căng thẳng, trầm lắng…) và để mọi lựa chọn phục vụ nó.'),
        ],
    },
]

export const getBriefById = (id: string | null | undefined) => STUDIO_BRIEFS.find((b) => b.id === id)
export const getBriefByConcept = (conceptId: string | null | undefined) => STUDIO_BRIEFS.find((b) => conceptId && b.conceptIds.includes(conceptId))
