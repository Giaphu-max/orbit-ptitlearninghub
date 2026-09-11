'use client'

import { useState } from 'react'
import { Play, ArrowLeft } from 'lucide-react'
import * as THREE from 'three'
import { VRViewport } from './vr-viewport'

interface Room {
    id: number
    title: string
    description: string
    thumbnail: string
    status: 'Sẵn sàng' | 'Đang bận'
    priceType: 'Miễn phí' | 'Premium'
    participants: number
    maxParticipants: number
}

const mockRooms: Room[] = [
    { id: 1, title: 'Studio Đánh Sáng Cơ Bản', description: 'Thực hành thiết lập ánh sáng Key, Fill, Rim cho người mới bắt đầu.', thumbnail: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=800&q=80', status: 'Sẵn sàng', priceType: 'Miễn phí', participants: 2, maxParticipants: 10 },
    { id: 2, title: 'Phim Trường Phông Xanh', description: 'Mô phỏng phim trường kỹ xảo với hệ thống tracking hiện đại.', thumbnail: 'https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?w=800&q=80', status: 'Sẵn sàng', priceType: 'Premium', participants: 5, maxParticipants: 8 },
    { id: 3, title: 'Phòng Motion Capture', description: 'Ghi hình chuyển động toàn thân với suit và camera hồng ngoại.', thumbnail: 'https://images.unsplash.com/photo-1616469829581-73993eb86b02?w=800&q=80', status: 'Đang bận', priceType: 'Premium', participants: 4, maxParticipants: 4 },
    { id: 4, title: 'Phòng Thu Âm Thanh (Foley)', description: 'Thực hành tái tạo âm thanh hiện trường và lồng tiếng.', thumbnail: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=800&q=80', status: 'Sẵn sàng', priceType: 'Miễn phí', participants: 0, maxParticipants: 2 },
]

export function OrbitVrView() {
    const [activeRoom, setActiveRoom] = useState<Room | null>(null)
    const [lights, setLights] = useState([
        { id: 'key', label: 'Key Light', brightness: 1, color: '#ffffff', position: new THREE.Vector3(5, 5, 5) },
        { id: 'fill', label: 'Fill Light', brightness: 0.5, color: '#ffffee', position: new THREE.Vector3(-5, 3, 5) },
        { id: 'rim', label: 'Rim Light', brightness: 0.8, color: '#aaddff', position: new THREE.Vector3(0, 5, -5) }
    ])

    if (activeRoom) {
        return (
            <div className="fixed inset-0 z-[100] bg-black">
                <button 
                    onClick={() => setActiveRoom(null)}
                    className="absolute top-6 left-6 z-[110] px-4 py-2.5 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md text-white border border-white/20 text-sm font-bold flex items-center gap-2 transition-all shadow-lg hover:scale-105"
                >
                    <ArrowLeft size={16} />
                    Thoát phòng {activeRoom.title}
                </button>
                <VRViewport 
                    focalLength={35}
                    iso={100}
                    shutter="1/125"
                    aperture="f/8"
                    lights={lights}
                    onLightsChange={setLights}
                />
            </div>
        )
    }

    return (
        <main className="relative flex-1 h-full w-full overflow-y-auto bg-transparent px-6 py-10 lg:px-10">
            <div className="max-w-[1200px] mx-auto flex flex-col">
                
                {/* Premium Header */}
                <div className="mb-14 text-center md:text-left flex flex-col items-center md:items-start">
                    <h1 className="text-4xl md:text-5xl font-bold text-gray-900 tracking-tight mb-4">VR360 Place<br/>Studio Thực Hành Ảo</h1>
                    <p className="text-lg text-gray-500 max-w-2xl">Trải nghiệm môi trường thực hành chuyên nghiệp chuẩn quốc tế ngay tại nhà. Tương tác với thiết bị ảo như thật.</p>
                </div>

                {/* Rooms Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-24 z-10">
                    {mockRooms.map(room => (
                        <div key={room.id} className="group relative w-full aspect-[16/9] rounded-[24px] overflow-hidden bg-gray-900 shadow-xl cursor-pointer">
                            
                            <img src={room.thumbnail} alt={room.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80 group-hover:opacity-60" />
                            <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent pointer-events-none" />
                            
                            {/* Badges Row */}
                            <div className="absolute top-5 left-5 pointer-events-none flex items-center gap-2">
                                {/* Status Pill */}
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider backdrop-blur-md border ${
                                    room.status === 'Sẵn sàng' ? 'bg-green-500/20 border-green-500/30 text-green-400' : 'bg-red-500/20 border-red-500/30 text-red-400'
                                }`}>
                                    <span className={`w-2 h-2 rounded-full ${room.status === 'Sẵn sàng' ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-red-500 shadow-[0_0_8px_#ef4444]'}`}></span>
                                    {room.status}
                                </span>
                                
                                {/* Pricing Badge */}
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider backdrop-blur-md border ${
                                    room.priceType === 'Miễn phí' ? 'bg-white/20 border-white/30 text-white' : 'bg-gradient-to-r from-red-600/80 to-rose-600/80 border-red-400/50 text-white'
                                }`}>
                                    {room.priceType}
                                </span>
                            </div>

                            <div className="absolute top-5 right-5 pointer-events-none">
                                <span className="px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white text-xs font-bold">
                                    {room.participants}/{room.maxParticipants} người
                                </span>
                            </div>

                            <div className="absolute inset-x-0 bottom-0 p-6 flex flex-col justify-end pointer-events-none">
                                <h3 className="text-2xl font-bold text-white mb-2">{room.title}</h3>
                                <p className="text-gray-300 text-sm line-clamp-2 mb-6 max-w-md">{room.description}</p>
                                
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setActiveRoom(room); }}
                                    className="pointer-events-auto self-start relative inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white text-sm font-bold transition-all group-hover:bg-red-600 group-hover:border-red-500 group-hover:shadow-[0_0_20px_rgba(220,38,38,0.4)]"
                                >
                                    <Play size={16} className="fill-current" />
                                    Vào phòng ảo
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

            </div>
        </main>
    )
}
