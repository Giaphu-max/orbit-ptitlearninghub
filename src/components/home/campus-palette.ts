// Bảng màu mô hình khuôn viên PTIT: một nguồn duy nhất cho cảnh 3D và ảnh tĩnh dự phòng.
// Đây là màu của "vật thể" trong cảnh (không đổi theo giao diện sáng/tối); chỉ ánh sáng đổi khi sang buổi tối.
export const CAMPUS = {
    plate: '#E8ECF2', plateDark: '#3A3030', plateEdge: '#2A3A6B', pave: '#9A9FA9', road: '#9A9FA9', grass: '#5CCB6E', grassDark: '#5CCB6E', lawnEdge: '#E8ECF2',
    cream: '#FFFFFF', granite: '#8C8583', glass: '#2EC3A8', win: '#41A5E1', roofRed: '#EE3B2E', edge: '#9AA0B4', shadowInk: '#0A1A50', grid: '#D5D9E3',
    yellow: '#FFFFFF', white: '#FFFFFF', stripe: '#D5E4F7', trunk: '#7A5544', tree: '#3FBF6A', tree2: '#2E9A55',
    glassBand: '#41A5E1', mmPink: '#F4878F', mmOrange: '#F39531', mmYellow: '#F4D431', ledRed: '#EE3B2E', solar: '#2C3E63', roofSlab: '#D5E4F7',
    suaWhite: '#F4F6F0', suaGreen: '#8CC163', roofFlat: '#FFFFFF', gateBlue: '#2F5AA8', signWhite: '#FFFFFF',
    // Màu sơn thật: Tòa A1 (xám xanh), hội trường/canteen (kem), cổng
    a1Wall: '#FFFFFF', a1Trim: '#1F63DB', hallWall: '#FFFFFF', a2Trim: '#D9DDE3', gateWall: '#E6E2DA',
    // Chi tiết nhỏ, biển hiệu và ánh sáng
    ink: '#1A1412',
    signBlue: '#1A3E8C',
    carDark: '#2B2B33',
    bandGreen: '#3C9E5B',
    flagBlue: '#3E7BD6',
    moonlight: '#7E8FD6',
    hallWindow: '#41A5E1',
    carSilver: '#B9C4CC',
    ptitRed: '#C4161C',
    // Chữ biển ban đêm: đỏ sáng như đèn LED và màu quầng
    // Chữ LED: lõi sáng gần trắng hồng, viền đỏ sáng; biển nền ban đêm xám than ấm
    ptitLedCore: '#FFE1DC',
    ptitLedEdge: '#FF3B3F',
    signNight: '#2A2523',
    ptitRedGlow: '#FF2A30',
    fence: '#C9C3BD',
    pillar: '#C9CDD3',
    gatePost: '#F4F6F8',
    gateBeam: '#F4F6F8',
    cornice: '#D5E4F7',
    flagYellow: '#F2C230',
    gateSign: '#BC2626',
    rimLight: '#FFE2C8',
    windowLit: '#FFD27A',
    // Tầng cửa sổ A2 đã đọc bài Daily: vàng ấm đậm để nổi cả ban ngày
    windowTier: '#FFAE1F',
    sunlight: '#FFFBEB',
    pureWhite: '#FFFFFF',
    skyLight: '#FFFFFF',
    groundLight: '#CFE3F5',
    // Buổi tối: ánh sáng bán cầu xanh đêm (không đỏ)
    nightSkyLight: '#6F80C8',
    nightGroundLight: '#1B2140',
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
    beige: '#D5E4F7', stone: '#6E86B8', parapet: '#D5E4F7', winG: '#41A5E1', glassM: '#41A5E1',
    step: '#C9493F', mat: '#B8463D', frame: '#3C4A63', mullion: '#5A5A5A', handle: '#BBBBBB',
    facade: '#2E8FD0', door: '#2E5A54', column: '#C9CDD3',
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
    roomFloor: '#C79B72', roomCeil: '#F2EEE9', desk: '#F4F0EA', deskLeg: '#888888', roomLamp: '#FFF6E8', roomPoint: '#FFF3E0',
    roomRed: '#C4161C', roomText: '#FFFFFF', point: '#FFF1E2', corridor: '#C79B72',
} as const
