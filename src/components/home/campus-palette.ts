// Bảng màu mô hình khuôn viên PTIT: một nguồn duy nhất cho cảnh 3D và ảnh tĩnh dự phòng.
// Đây là màu của "vật thể" trong cảnh (không đổi theo giao diện sáng/tối); chỉ ánh sáng đổi khi sang buổi tối.
export const CAMPUS = {
    plate: '#EFE7E1', plateEdge: '#8E0E13', pave: '#E2D8D0', road: '#6B5F5C', grass: '#8DBF8F', grassDark: '#6FA474',
    cream: '#F4EEE4', granite: '#8C8583', glass: '#2E8C70', win: '#3F8F79', roofRed: '#C23A2C',
    yellow: '#EFC86E', white: '#F7F4EF', stripe: '#BDB5AE', trunk: '#7A5544', tree: '#5E9E6A', tree2: '#7DB27A',
    // Chi tiết nhỏ, biển hiệu và ánh sáng
    ink: '#1A1412',
    signBlue: '#1A3E8C',
    carDark: '#2B2B33',
    bandGreen: '#3C9E5B',
    flagBlue: '#3E7BD6',
    moonlight: '#7E8FD6',
    hallWindow: '#9FB7C4',
    carSilver: '#B9C4CC',
    ptitRed: '#C4161C',
    fence: '#C9C3BD',
    pillar: '#D6D2CF',
    gatePost: '#D8C29C',
    gateBeam: '#E4D7BF',
    cornice: '#E8E0D4',
    flagYellow: '#F2C230',
    gateSign: '#F3EFEA',
    rimLight: '#FF6B5E',
    windowLit: '#FFD27A',
    sunlight: '#FFD9B8',
    pureWhite: '#FFFFFF',
    skyLight: '#FFE9E0',
    groundLight: '#5A2A28',
} as const

// Màu vật thể và ánh sáng của studio Virtual Director (cảnh 3D, không đổi theo giao diện sáng/tối).
export const STUDIO = {
    floor: '#D9D2CB', backdrop: '#B9B0A8', plinth: '#8E0E13',
    skin: '#E8B99A', hair: '#2E211A', suit: '#2B2B33', scarf: '#C4161C',
    propBlue: '#3E7BD6', propYellow: '#EFC86E', propGreen: '#5E9E6A', column: '#F4EEE4',
    key: '#FFE2C2', fill: '#CFE0FF', rim: '#FFB3A8', ambient: '#FFFFFF',
} as const
