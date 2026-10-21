// Bảng màu mô hình khuôn viên PTIT: một nguồn duy nhất cho cảnh 3D và ảnh tĩnh dự phòng.
// Đây là màu của "vật thể" trong cảnh (không đổi theo giao diện sáng/tối); chỉ ánh sáng đổi khi sang buổi tối.
export const CAMPUS = {
    plate: '#EFE7E1', plateDark: '#3A3030', plateEdge: '#8E0E13', pave: '#E2D8D0', road: '#6B5F5C', grass: '#8DBF8F', grassDark: '#6FA474',
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
    // Tầng cửa sổ A2 đã đọc bài Daily: vàng ấm đậm để nổi cả ban ngày
    windowTier: '#FFAE1F',
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

// Tòa A2 (đế rộng, sảnh kính) và Hội trường A2: màu vật thể, lấy từ bản mẫu docs/mockup/orbit-campus-journey.html.
export const A2COL = {
    beige: '#E6D6C0', stone: '#D8C6AE', parapet: '#F2E8DA', winG: '#6FAE96', glassM: '#4F9C82',
    step: '#C9493F', mat: '#B8463D', frame: '#3A3A3A', mullion: '#5A5A5A', handle: '#BBBBBB',
    facade: '#6F9C93', door: '#2E5A54', column: '#FFFFFF',
    hallSign: '#C4161C', hallSignText: '#FFFFFF', hallDoor: '#3A3030',
} as const

// Sảnh A2 bên trong (nhìn xuyên qua mặt kính)
export const LOBBY = {
    floor: '#A9A8A5', floorBand: '#C9A97E', floorLine: '#262626',
    white: '#F4F2EF', granite: '#8E8B87', wood: '#C99A63', ceiling: '#4C4B4D', slab: '#FFFFFF',
    rail: '#D8EEF0', railBar: '#888888', light: '#FFF6E6', led: '#FFFFFF', gold: '#C8A060',
    colBase: '#B5B1AC', ottoman: '#C8C6C3', tableTop: '#F2F0EC', tableLeg: '#222222',
    plantA: '#4E8A3E', plantB: '#3B7432', plantC: '#3E7A33',
    bannerA: '#2E2470', bannerB: '#4A2C8C', bannerLine: '#D8B66A', bannerText: '#FFFFFF',
    techA: '#0E2A5C', techB: '#1E5C9C', techLine: 'rgba(120,200,255,.35)', techText: '#FFFFFF',
    loveBg: '#8F96A3', loveTile: '255,255,255', loveRed: '#E0262E', loveRed2: '#B8141B', loveDark: '#1A0A0A',
    houseRoof: '#9C9893', kiosk: '#F3F2EF', screen: '#0B0B0D', screenGlow: '#140A0B',
    roomRed: '#C4161C', roomText: '#FFFFFF', point: '#FFF1E2', corridor: '#C79B72',
} as const
