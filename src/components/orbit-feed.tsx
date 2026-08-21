'use client'

import { useState } from 'react'
import { ChevronDown, MapPin, Search, X, Camera, Lightbulb, MonitorPlay, Settings2, SlidersHorizontal, Images, Clock, Download } from 'lucide-react'
import { VRViewport } from './vr-viewport'

type Studio = {
    title: string;
    description: string;
    type: string;
    image: string;
    status: string;
}

export interface LightState {
    id: string
    label: string
    brightness: number
    color: string
    position: { x: number; y: number; z: number }
}

const defaultLights: LightState[] = [
    { id: 'key-ceil', label: 'Key Light (Ceiling)', brightness: 1.0, color: '#ffffff', position: { x: 0, y: 3.9, z: -3 } },
    { id: 'fill-left', label: 'Fill Light (Left Box)', brightness: 0.7, color: '#ffffee', position: { x: -3, y: 2.1, z: -2 } },
    { id: 'fill-right', label: 'Fill Light (Right Box)', brightness: 0.7, color: '#ffffee', position: { x: 3, y: 2.1, z: -2 } },
    { id: 'rim-back', label: 'Rim Light (Back Box)', brightness: 0.4, color: '#aaddff', position: { x: 0, y: 2.1, z: -8 } },
]

const studios: Studio[] = [
    { title: 'Studio Đánh Sáng Cơ Bản', description: '3 Camera, 5 Đèn trần', type: 'Studio', image: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=85', status: 'Sẵn sàng' },
    { title: 'Phim Trường Phông Xanh', description: 'Hỗ trợ export workflow sang Maya, Blender', type: 'Phim trường', image: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=900&q=85', status: 'Sẵn sàng' },
    { title: 'Phòng Rigging Nhân Vật', description: 'Character rig, motion capture, 4K render', type: '3D Modeling', image: 'https://images.unsplash.com/photo-1535378917042-10a22c95931a?auto=format&fit=crop&w=900&q=85', status: 'Đang bận' },
    { title: 'Virtual Production Stage', description: 'LED wall 12m, camera tracking, HDRI', type: 'Phim trường', image: 'https://images.unsplash.com/photo-1531058020387-3be344556be6?auto=format&fit=crop&w=900&q=85', status: 'Sẵn sàng' },
    { title: 'Studio Product 360', description: 'Turntable 360°, softbox, macro lens', type: 'Studio', image: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=900&q=85', status: 'Sẵn sàng' },
    { title: 'Phòng Motion Capture', description: '16 camera hồng ngoại, full body tracking', type: '3D Modeling', image: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=900&q=85', status: 'Đang bận' },
]

export function OrbitFeed() {
    const [searchQuery, setSearchQuery] = useState('')
    const [roomTypeFilter, setRoomTypeFilter] = useState('Tất cả')
    const [statusFilter, setStatusFilter] = useState('Tất cả')
    const [selectedStudio, setSelectedStudio] = useState<Studio | null>(null)
    const [isGalleryOpen, setIsGalleryOpen] = useState(false)

    const [focalLength, setFocalLength] = useState(35)
    const [lights, setLights] = useState<LightState[]>(defaultLights)
    const [mediaGallery, setMediaGallery] = useState<{ dataUrl: string; timestamp: string; label: string }[]>([])
    const [selectedImage, setSelectedImage] = useState<{ dataUrl: string; label: string } | null>(null)

    const handleSnapshot = (dataUrl: string, timestamp: string) => {
        const idx = mediaGallery.length + 1
        setMediaGallery(prev => [...prev, {
            dataUrl,
            timestamp,
            label: `Snapshot_${String(idx).padStart(2, '0')}_${timestamp.replace(/:/g, '-')}.png`
        }])
    }

    const filteredStudios = studios.filter(studio => {
        const matchesSearch = studio.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            studio.description.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesType = roomTypeFilter === 'Tất cả' || studio.type === roomTypeFilter
        const matchesStatus = statusFilter === 'Tất cả' || studio.status === statusFilter
        return matchesSearch && matchesType && matchesStatus
    })

    const handleExitStudio = () => {
        setSelectedStudio(null)
        setFocalLength(35)
        setLights(defaultLights)
    }

    return (
        <main className="relative flex-1 h-full w-full overflow-y-auto bg-[#f8f9fa] p-8">
            <div className="w-full">
                <header className="mb-7">
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">VR360 Place - Studio Thực Hành Ảo</h1>
                    <p className="mt-2 text-gray-500">Lựa chọn phòng studio 3D để thực hành set-up camera, đánh sáng và quay phim.</p>
                </header>

                <div className="mb-8 flex flex-wrap items-center gap-4">
                    <label className="relative block min-w-[280px] flex-1 lg:max-w-md">
                        <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-4 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-red-400 focus:ring-2 focus:ring-red-100"
                            placeholder="Tìm kiếm studio..."
                            aria-label="Tìm kiếm studio"
                        />
                    </label>
                    <div className="relative">
                        <select
                            value={roomTypeFilter}
                            onChange={(e) => setRoomTypeFilter(e.target.value)}
                            className="appearance-none flex h-10 items-center rounded-lg border border-gray-200 bg-white pl-3 pr-10 text-sm text-gray-700 shadow-sm transition hover:border-gray-300 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 cursor-pointer"
                        >
                            <option value="Tất cả">Loại phòng: Tất cả</option>
                            <option value="Studio">Studio</option>
                            <option value="Phim trường">Phim trường</option>
                            <option value="3D Modeling">3D Modeling</option>
                        </select>
                        <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    </div>
                    <div className="relative">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="appearance-none flex h-10 items-center rounded-lg border border-gray-200 bg-white pl-3 pr-10 text-sm text-gray-700 shadow-sm transition hover:border-gray-300 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 cursor-pointer"
                        >
                            <option value="Tất cả">Trạng thái: Tất cả</option>
                            <option value="Sẵn sàng">Sẵn sàng</option>
                            <option value="Đang bận">Đang bận</option>
                        </select>
                        <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    </div>
                </div>

                <section className="grid grid-cols-1 gap-6 gap-y-10 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-label="Danh sách studio">
                    {filteredStudios.map((studio) => {
                        const available = studio.status === 'Sẵn sàng'
                        return (
                            <article key={studio.title} className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                                <div className="relative aspect-video overflow-hidden bg-gray-200">
                                    <img src={studio.image} alt={studio.title} className="h-full w-full object-cover transition duration-500 hover:scale-105" />
                                    <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-gray-700 shadow-sm backdrop-blur-sm">
                                        <span className={`h-1.5 w-1.5 rounded-full ${available ? 'bg-emerald-500' : 'bg-red-500'}`} />{studio.status}
                                    </span>
                                </div>
                                <div className="flex min-h-[178px] flex-col gap-3 p-4">
                                    <div>
                                        <span className="text-xs font-medium text-red-600">{studio.type}</span>
                                        <h2 className="mt-1 text-base font-bold text-gray-900">{studio.title}</h2>
                                        <p className="mt-1 text-sm leading-5 text-gray-500">{studio.description}</p>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={!available}
                                        onClick={() => { if (available) setSelectedStudio(studio) }}
                                        className={`mt-auto flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition ${available ? 'bg-red-600 text-white hover:bg-red-700' : 'cursor-not-allowed bg-gray-200 text-gray-400'}`}
                                    >
                                        <MapPin size={15} />Vào phòng ảo
                                    </button>
                                </div>
                            </article>
                        )
                    })}
                    {filteredStudios.length === 0 && (
                        <div className="col-span-full py-12 text-center text-gray-500">
                            Không tìm thấy studio nào phù hợp với bộ lọc.
                        </div>
                    )}
                </section>
            </div>

            {/* VR Modal */}
            {selectedStudio && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
                    <div className="w-full max-w-7xl h-full max-h-[92vh] bg-gray-900 rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-white/10">

                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-3 bg-gray-950/80 border-b border-white/10 shrink-0">
                            <div className="flex items-center gap-4">
                                <h2 className="text-lg font-bold text-white">{selectedStudio.title}</h2>
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-xs font-medium text-emerald-400">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Simulation Active
                                </span>
                            </div>
                            <button
                                onClick={handleExitStudio}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white transition-colors border border-red-600/20 text-sm"
                            >
                                <X size={16} />
                                Thoát phòng ảo
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex flex-1 overflow-hidden min-h-0">
                            {/* Three.js VR Viewport */}
                            <div className="flex-1 relative overflow-hidden">
                                <VRViewport
                                    focalLength={focalLength}
                                    lights={lights}
                                    onLightsChange={setLights}
                                    onFocalLengthChange={setFocalLength}
                                    onSnapshot={handleSnapshot}
                                />
                            </div>

                            {/* Right Control Panel */}
                            <div className="w-[320px] shrink-0 bg-gray-950 border-l border-white/10 flex flex-col overflow-y-auto">
                                <div className="p-5 border-b border-white/10">
                                    <h3 className="text-white font-semibold flex items-center gap-2 text-sm">
                                        <Settings2 size={15} className="text-gray-400" /> Global Control Panel
                                    </h3>
                                    <p className="text-gray-500 text-xs mt-1">Click lights in-scene for direct control</p>
                                </div>

                                <div className="p-5 space-y-7">
                                    {/* Camera */}
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                            <Camera size={13} /> Camera
                                        </h4>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-gray-300">Focal Length</span>
                                            <span className="text-white font-mono">{focalLength}mm</span>
                                        </div>
                                        <input
                                            type="range" min="14" max="200"
                                            value={focalLength}
                                            onChange={(e) => setFocalLength(Number(e.target.value))}
                                            className="w-full accent-red-500 cursor-pointer"
                                        />
                                        <div className="grid grid-cols-2 gap-2">
                                            <button className="py-1.5 text-xs font-medium text-white bg-white/10 rounded border border-white/5 hover:bg-white/20 transition-colors">Cam 1 (Front)</button>
                                            <button className="py-1.5 text-xs font-medium text-gray-400 bg-transparent rounded border border-white/5 hover:bg-white/10 transition-colors">Cam 2 (Top)</button>
                                        </div>
                                    </div>

                                    {/* Lighting summary */}
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                            <Lightbulb size={13} /> Lighting — Global Override
                                        </h4>
                                        <div className="space-y-2">
                                            {lights.map((light) => (
                                                <div key={light.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-white/10 bg-white/[0.02]">
                                                    <div
                                                        className="w-3 h-3 rounded-full shrink-0 border border-white/20"
                                                        style={{ backgroundColor: light.color }}
                                                    />
                                                    <span className="text-xs text-gray-300 flex-1 truncate">{light.label}</span>
                                                    <input
                                                        type="range" min="0" max="1" step="0.05"
                                                        value={light.brightness}
                                                        onChange={(e) => setLights(lights.map(l => l.id === light.id ? { ...l, brightness: parseFloat(e.target.value) } : l))}
                                                        className="w-20 accent-red-500 cursor-pointer"
                                                    />
                                                    <span className="text-xs font-mono text-gray-500 w-6 text-right">{Math.round(light.brightness * 100)}%</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Render */}
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                            <SlidersHorizontal size={13} /> Render Setup
                                        </h4>
                                        <div>
                                            <label className="text-xs text-gray-500 mb-1 block">Render Engine</label>
                                            <select className="w-full bg-gray-900 border border-white/10 rounded-lg p-2 text-xs text-white outline-none focus:border-red-500">
                                                <option>Real-time (Eevee)</option>
                                                <option>Path Tracing (Cycles)</option>
                                            </select>
                                        </div>
                                        <button
                                            onClick={() => setIsGalleryOpen(true)}
                                            className="w-full flex items-center justify-center gap-2 py-2.5 mt-2 rounded-lg bg-white text-black font-semibold hover:bg-gray-200 transition-colors text-sm"
                                        >
                                            <Images size={15} /> Xem kho đa phương tiện
                                        </button>
                                        <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 transition-colors text-xs border border-white/10">
                                            <MonitorPlay size={14} /> Record Session
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Media Gallery Modal */}
            {isGalleryOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-md p-6">
                    <div className="w-full max-w-5xl h-full max-h-[88vh] bg-gray-900 rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-white/10">
                        {/* Gallery Header */}
                        <div className="flex items-center justify-between px-6 py-4 bg-gray-950/60 border-b border-white/10 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-red-600/20 border border-red-600/30 flex items-center justify-center">
                                    <Images size={16} className="text-red-400" />
                                </div>
                            <div>
                                    <h2 className="text-white font-bold text-lg leading-none">Kho Đa Phương Tiện</h2>
                                    <p className="text-gray-500 text-xs mt-0.5">{mediaGallery.length} mục đã chụp • Phải chuột để chụp ảnh trong studio</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsGalleryOpen(false)}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/10 transition-colors border border-white/10"
                            >
                                <X size={16} /> Đóng
                            </button>
                        </div>

                        {/* Gallery Grid */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {mediaGallery.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-500">
                                    <Images size={40} className="opacity-30" />
                                    <div className="text-center">
                                        <p className="font-medium text-sm">Chưa có ảnh nào</p>
                                        <p className="text-xs mt-1 text-gray-600">Vào studio và nhấn chuột phải để chụp ảnh</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {mediaGallery.map((item, i) => (
                                        <div
                                            key={i}
                                            className="group relative rounded-2xl overflow-hidden border border-white/10 hover:border-white/25 transition-all duration-300 hover:-translate-y-0.5 cursor-pointer"
                                            onClick={() => setSelectedImage({ dataUrl: item.dataUrl, label: item.label })}
                                        >
                                            {/* Real captured thumbnail */}
                                            <div className="aspect-video relative overflow-hidden bg-gray-800">
                                                <img src={item.dataUrl} alt={item.label} className="w-full h-full object-cover" />
                                                {/* Hover overlay: expand icon in center, download in corner */}
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center">
                                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                                                        <span className="px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-sm text-white text-xs font-medium flex items-center gap-1.5">
                                                            <Images size={13} /> Xem đầy đủ
                                                        </span>
                                                    </div>
                                                    <a
                                                        href={item.dataUrl}
                                                        download={item.label}
                                                        onClick={e => e.stopPropagation()}
                                                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-full bg-white/20 backdrop-blur-sm text-white hover:bg-white/30"
                                                    >
                                                        <Download size={14} />
                                                    </a>
                                                </div>
                                            </div>
                                            {/* Info */}
                                            <div className="p-3 bg-gray-900/80">
                                                <p className="text-white text-xs font-medium truncate">{item.label}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Clock size={10} className="text-gray-600" />
                                                    <span className="text-gray-500 text-xs">{item.timestamp}</span>
                                                    <span className="ml-auto">
                                                        <a href={item.dataUrl} download={item.label}
                                                            className="text-gray-600 hover:text-white text-xs transition">
                                                            <Download size={11} />
                                                        </a>
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Lightbox modal */}
            {selectedImage && (
                <div
                    className="fixed inset-0 z-[70] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4"
                    onClick={() => setSelectedImage(null)}
                >
                    {/* Top bar */}
                    <div
                        className="w-full max-w-5xl flex items-center justify-between mb-3 px-1"
                        onClick={e => e.stopPropagation()}
                    >
                        <p className="text-white/70 text-sm font-medium truncate max-w-[60%]">{selectedImage.label}</p>
                        <div className="flex items-center gap-2">
                            <a
                                href={selectedImage.dataUrl}
                                download={selectedImage.label}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition border border-white/10"
                            >
                                <Download size={13} /> Tải về
                            </a>
                            <button
                                onClick={() => setSelectedImage(null)}
                                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition border border-white/10"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Full-res image */}
                    <img
                        src={selectedImage.dataUrl}
                        alt={selectedImage.label}
                        className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl ring-1 ring-white/10"
                        onClick={e => e.stopPropagation()}
                    />

                    {/* Click outside hint */}
                    <p className="mt-3 text-white/25 text-xs">Click bên ngoài hoặc nhấn X để đóng</p>
                </div>
            )}
        </main>
    )
}
