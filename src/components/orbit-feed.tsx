'use client'

import { useState, useRef } from 'react'
import { ChevronDown, MapPin, Search, X, Camera, Lightbulb, MonitorPlay, Settings2, SlidersHorizontal, Images, Clock, Download, Battery, Info, Play, Menu, Trash2 } from 'lucide-react'
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
    { id: 'key', label: 'Key Light', brightness: 1.0, color: '#ffffff', position: { x: 5, y: 5, z: 5 } },
    { id: 'fill', label: 'Fill Light', brightness: 0.5, color: '#ffffee', position: { x: -5, y: 3, z: 5 } },
    { id: 'rim', label: 'Rim Light', brightness: 0.8, color: '#aaddff', position: { x: 0, y: 5, z: -5 } },
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
    const [showControlPanel, setShowControlPanel] = useState(false)
    const [showHud, setShowHud] = useState(true)
    const apertureList = ['1.8', '2.8', '4.0', '5.6', '8.0', '11', '16', '22']
    const shutterList = ['1/4000', '1/1000', '1/250', '1/125', '1/60', '1/30', '1/15', '1/4', '1"', '2"']
    const isoList = [100, 200, 400, 800, 1600, 3200, 6400]

    const [cameraMode, setCameraMode] = useState<'M' | 'Av' | 'Tv'>('M')
    const [apertureIndex, setApertureIndex] = useState(3) // 5.6
    const [shutterIndex, setShutterIndex] = useState(3) // 1/125
    const [isoIndex, setIsoIndex] = useState(3) // 800
    const [activeSetting, setActiveSetting] = useState<'ISO' | null>(null)

    const aperture = `F${apertureList[apertureIndex]}`
    const shutter = shutterList[shutterIndex]
    const iso = isoList[isoIndex]
    const snapshotTriggerRef = useRef<(() => void) | null>(null)

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

            {/* VR Modal — Canon EOS R50 Authentic Chassis */}
            {selectedStudio && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a0a]/95 backdrop-blur-md p-4">
                    
                    {/* CAMERA CHASSIS CONTAINER */}
                    <div className="relative w-[90vw] max-w-[1200px] aspect-[1.5/1] rounded-l-[40px] rounded-r-[120px] shadow-[0_30px_80px_rgba(0,0,0,0.95)] border border-[#333] select-none"
                         style={{ 
                             backgroundColor: '#1c1c1c',
                             backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\' opacity=\'0.15\'/%3E%3C/svg%3E"), radial-gradient(circle at 75% 50%, rgba(255,255,255,0.05) 0%, transparent 40%)'
                         }}>
                        
                        {/* ── 1. EVF HUMP (Top center-left) ── */}
                        <div className="absolute top-[-8%] left-[25%] w-[30%] h-[12%] bg-[#1c1c1c] rounded-t-[60px] shadow-[inset_0_4px_15px_rgba(255,255,255,0.1)] border border-[#333] z-0"></div>
                        <div className="absolute top-[-5%] left-[27%] w-[26%] h-[14%] bg-[#0a0a0a] rounded-t-[50px] rounded-b-[20px] shadow-[0_10px_20px_rgba(0,0,0,0.8),_inset_0_2px_8px_rgba(255,255,255,0.15)] z-10 border border-[#222] flex items-center justify-center">
                            {/* Viewfinder Glass */}
                            <div className="w-[45%] h-[55%] bg-black rounded shadow-[inset_0_0_15px_rgba(0,0,0,1)] border border-[#111]"></div>
                        </div>

                        {/* ── 2. MENU Button (Top-left) ── */}
                        <div className="absolute top-[8%] left-[4%] w-[6%] aspect-square rounded-full shadow-[inset_0_3px_8px_rgba(0,0,0,0.9)] flex items-center justify-center bg-[#111] border border-[#222]">
                            <button onClick={() => setShowControlPanel(p => !p)} 
                                className="w-[75%] h-[75%] rounded-full bg-[#2a2a2a] shadow-[0_2px_4px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.1)] active:translate-y-[2px] active:shadow-inner border border-[#444] text-white font-bold flex items-center justify-center"
                                style={{ fontSize: 'clamp(8px, 0.7vw, 12px)' }}>
                                MENU
                            </button>
                        </div>

                        {/* ── 3. LCD SCREEN & HINGES ── */}
                        {/* Hinges */}
                        <div className="absolute left-[-2px] top-[25%] w-[2%] h-[12%] bg-[#111] rounded-r-md border-y border-r border-[#333] shadow-[4px_0_10px_rgba(0,0,0,0.5)] z-10"></div>
                        <div className="absolute left-[-2px] top-[75%] w-[2%] h-[12%] bg-[#111] rounded-r-md border-y border-r border-[#333] shadow-[4px_0_10px_rgba(0,0,0,0.5)] z-10"></div>

                        {/* LCD Bezel */}
                        <div className="absolute top-[12%] left-[4%] w-[75%] h-[82%] bg-[#050505] rounded-xl shadow-[0_2px_15px_rgba(0,0,0,0.9),_inset_0_4px_12px_rgba(0,0,0,0.9)] border border-[#2a2a2a] p-[0.75%] flex flex-col justify-center items-center z-20">
                            {/* Canvas Wrapper (Strict 3:2 Aspect Ratio) */}
                            <div className="relative w-full aspect-[3/2] bg-[#111] shadow-[inset_0_0_30px_rgba(0,0,0,1)] overflow-hidden rounded-sm ring-2 ring-black">
                                <VRViewport
                                    focalLength={focalLength}
                                    iso={iso}
                                    shutter={shutter}
                                    aperture={aperture}
                                    lights={lights}
                                    onLightsChange={setLights}
                                    onFocalLengthChange={setFocalLength}
                                    onSnapshot={handleSnapshot}
                                    onSnapshotTriggerReady={(fn) => { snapshotTriggerRef.current = fn }}
                                />

                                {/* HUD Overlay */}
                                {showHud && (
                                    <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-3">
                                        {/* Top HUD */}
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded px-2 py-1 pointer-events-auto cursor-pointer hover:bg-black/80 transition"
                                                onClick={() => setCameraMode(m => m === 'M' ? 'Av' : m === 'Av' ? 'Tv' : 'M')}>
                                                <span className="text-white text-sm font-bold font-mono tracking-widest">[{cameraMode}]</span>
                                                <span className="text-zinc-400 text-[10px] font-mono">{cameraMode === 'M' ? 'MANUAL' : cameraMode === 'Av' ? 'APERTURE PRIORITY' : 'SHUTTER PRIORITY'}</span>
                                            </div>
                                            <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded px-2 py-1">
                                                <Battery size={14} className="text-green-400" />
                                                <span className="text-zinc-200 text-[11px] font-mono">█████</span>
                                                <span className="text-zinc-400 text-[11px] font-mono ml-1">SD</span>
                                                <span className="text-white text-[11px] font-mono">{9999 - mediaGallery.length}</span>
                                            </div>
                                        </div>
                                        
                                        {/* Bottom HUD */}
                                        <div className="flex items-end justify-between pointer-events-auto">
                                            <div className="flex items-center gap-3 bg-black/70 backdrop-blur-sm rounded-lg px-3 py-2">
                                                {[
                                                    { label: 'SS', value: shutter, isAuto: cameraMode === 'Av', isEditing: false },
                                                    { label: 'AV', value: aperture, isAuto: cameraMode === 'Tv', isEditing: false },
                                                    { label: 'ISO', value: String(iso), isAuto: false, isEditing: activeSetting === 'ISO' },
                                                    { label: 'FL', value: `${focalLength}mm`, isAuto: false, isEditing: false },
                                                ].map(({ label, value, isAuto, isEditing }, i, arr) => (
                                                    <span key={label} className={`flex items-center gap-3 ${isAuto ? 'opacity-50' : 'opacity-100'} transition-opacity`}>
                                                        <span className="flex flex-col items-center">
                                                            <span className="text-zinc-500 text-[8px] uppercase tracking-widest">{label}</span>
                                                            <span className={`font-mono text-sm font-bold ${isEditing ? 'text-yellow-400' : 'text-white'}`}>{value}</span>
                                                        </span>
                                                        {i < arr.length - 1 && <span className="w-px h-5 bg-zinc-600/70" />}
                                                    </span>
                                                ))}
                                                <span className="w-px h-5 bg-zinc-600/70" />
                                                <span className="flex flex-col items-center">
                                                    <span className="text-zinc-500 text-[8px] uppercase tracking-widest">EV</span>
                                                    <span className="flex items-end gap-0.5 mt-0.5">
                                                        {[-3,-2,-1,0,1,2,3].map(v => (
                                                            <span key={v} className={`w-[3px] rounded-full ${v===0 ? 'h-3 bg-white' : Math.abs(v)===1 ? 'h-2 bg-zinc-400' : 'h-1.5 bg-zinc-600'}`} />
                                                        ))}
                                                    </span>
                                                </span>
                                            </div>
                                            <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-1.5 flex items-center gap-1.5">
                                                <Images size={11} className="text-zinc-400" />
                                                <span className="text-white font-mono text-xs font-bold">{mediaGallery.length}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── 4. CONTROL PANEL SLIDE-IN (Positioned over LCD) ── */}
                        {showControlPanel && (
                            <div className="absolute top-[12%] left-[4%] w-[75%] h-[82%] z-30 bg-[#1a1a1a]/95 backdrop-blur-md rounded-xl border border-[#333] shadow-2xl flex overflow-hidden">
                                <div className="w-[300px] bg-[#111] border-r border-[#333] flex flex-col">
                                    <div className="px-4 py-3 border-b border-zinc-700/50 flex items-center justify-between shrink-0">
                                        <h3 className="text-white font-bold text-sm flex items-center gap-2">
                                            <Settings2 size={13} className="text-red-400" /> MENU
                                        </h3>
                                        <button onClick={() => setShowControlPanel(false)} className="text-zinc-500 hover:text-white transition"><X size={14} /></button>
                                    </div>
                                    <div className="p-4 space-y-5 overflow-y-auto flex-1">
                                        <div className="space-y-2">
                                            <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5"><Camera size={10} /> Camera</h4>
                                            <div className="flex justify-between text-xs"><span className="text-zinc-300">Focal Length</span><span className="text-white font-mono">{focalLength}mm</span></div>
                                            <input type="range" min="14" max="200" value={focalLength} onChange={e => setFocalLength(Number(e.target.value))} className="w-full accent-red-500" />
                                            <div className="flex justify-between text-xs mt-1"><span className="text-zinc-300">ISO</span><span className="text-white font-mono">{iso}</span></div>
                                            <input type="range" min="0" max={isoList.length - 1} step="1" value={isoIndex} onChange={e => setIsoIndex(Number(e.target.value))} className="w-full accent-red-500" />
                                            <div className="grid grid-cols-3 gap-1 mt-1">
                                                {shutterList.map((s, idx) => (
                                                    <button key={s} onClick={() => setShutterIndex(idx)} className={`py-1 text-[10px] font-mono rounded border transition ${shutterIndex===idx ? 'bg-red-600/30 border-red-500/50 text-red-300' : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10'}`}>{s}</button>
                                                ))}
                                            </div>
                                            <div className="grid grid-cols-4 gap-1">
                                                {apertureList.map((av, idx) => (
                                                    <button key={av} onClick={() => setApertureIndex(idx)} className={`py-1 text-[10px] font-mono rounded border transition ${apertureIndex===idx ? 'bg-red-600/30 border-red-500/50 text-red-300' : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10'}`}>F{av}</button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5"><Lightbulb size={10} /> Lighting</h4>
                                            {lights.map(l => (
                                                <div key={l.id} className="flex items-center gap-2 p-2 rounded-lg border border-white/8 bg-white/[0.02]">
                                                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
                                                    <span className="text-[10px] text-zinc-300 flex-1 truncate">{l.label}</span>
                                                    <input type="range" min="0" max="1" step="0.05" value={l.brightness}
                                                        onChange={e => setLights(lights.map(x => x.id === l.id ? { ...x, brightness: parseFloat(e.target.value) } : x))}
                                                        className="w-16 accent-red-500" />
                                                    <span className="text-[10px] font-mono text-zinc-500 w-6">{Math.round(l.brightness*100)}%</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="space-y-2">
                                            <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5"><SlidersHorizontal size={10} /> Render</h4>
                                            <select className="w-full bg-zinc-900 border border-white/10 rounded p-1.5 text-xs text-white outline-none focus:border-red-500">
                                                <option>Real-time (Eevee)</option><option>Path Tracing (Cycles)</option>
                                            </select>
                                            <button onClick={handleExitStudio}
                                                className="w-full flex items-center justify-center gap-2 py-2 rounded bg-red-600/20 border border-red-600/30 text-red-400 text-xs font-bold hover:bg-red-600/30 transition mt-2">
                                                <X size={12} /> THOÁT PHÒNG ẢO
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex-1 cursor-pointer" onClick={() => setShowControlPanel(false)}></div>
                            </div>
                        )}

                        {/* ── 5. RIGHT HARDWARE CONTROLS (Absolute Positioning) ── */}
                        
                        {/* Top Edge Dial */}
                        <div className="absolute top-[-3%] right-[12%] w-[8%] aspect-[2/1] bg-gradient-to-b from-[#666] to-[#222] rounded-t-[20px] shadow-[0_5px_15px_rgba(0,0,0,0.8)] border border-[#555] flex flex-col justify-evenly overflow-hidden z-0">
                            <div className="w-full h-[2px] bg-[#111]"></div>
                            <div className="w-full h-[2px] bg-[#111]"></div>
                            <div className="w-full h-[2px] bg-[#111]"></div>
                        </div>

                        {/* AF ON Button */}
                        <div className="absolute top-[8%] right-[10%] w-[6%] aspect-square rounded-full shadow-[inset_0_3px_6px_rgba(0,0,0,0.8)] flex items-center justify-center bg-[#111] border border-[#222] z-10">
                            <button onClick={() => snapshotTriggerRef.current?.()} 
                                className="w-[85%] h-[85%] rounded-full bg-[#2a2a2a] shadow-[0_3px_5px_rgba(0,0,0,0.6),inset_0_1px_2px_rgba(255,255,255,0.15)] active:translate-y-[2px] active:shadow-inner border border-[#444] text-white flex flex-col items-center justify-center leading-none"
                                style={{ fontSize: 'clamp(6px, 0.5vw, 10px)' }}>
                                <span className="font-bold">AF</span>
                                <span className="font-bold">ON</span>
                            </button>
                        </div>

                        {/* * (AE Lock) Button */}
                        <div className="absolute top-[22%] right-[4%] w-[5%] aspect-square rounded-full shadow-[inset_0_2px_5px_rgba(0,0,0,0.8)] flex items-center justify-center bg-[#111] border border-[#222] z-10">
                            <button className="w-[80%] h-[80%] rounded-full bg-[#2a2a2a] shadow-[0_2px_4px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.1)] active:translate-y-[2px] active:shadow-inner border border-[#444] text-white font-black flex items-center justify-center"
                                style={{ fontSize: 'clamp(10px, 1vw, 16px)' }}>
                                ✱
                            </button>
                        </div>

                        {/* INFO Button */}
                        <div className="absolute top-[40%] right-[14%] w-[5%] aspect-square rounded-full shadow-[inset_0_2px_5px_rgba(0,0,0,0.8)] flex items-center justify-center bg-[#111] border border-[#222] z-10">
                            <button onClick={() => setShowHud(p => !p)} 
                                className="w-[80%] h-[80%] rounded-full bg-[#2a2a2a] shadow-[0_2px_4px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.1)] active:translate-y-[2px] active:shadow-inner border border-[#444] text-white font-bold flex items-center justify-center"
                                style={{ fontSize: 'clamp(6px, 0.5vw, 10px)' }}>
                                INFO
                            </button>
                        </div>

                        {/* D-PAD (Directional Pad) */}
                        <div className="absolute top-[52%] right-[3%] w-[14%] aspect-square rounded-full shadow-[inset_0_4px_12px_rgba(0,0,0,0.9),0_2px_5px_rgba(255,255,255,0.05)] flex items-center justify-center bg-[#181818] border border-[#2a2a2a] z-10">
                            {/* Engraved symbols */}
                            <span className="absolute top-[6%] left-1/2 -translate-x-1/2 text-zinc-500 font-bold tracking-widest pointer-events-none" style={{ fontSize: 'clamp(5px, 0.4vw, 8px)' }}>ISO</span>
                            <span className="absolute bottom-[6%] left-1/2 -translate-x-1/2 text-zinc-500 font-bold tracking-widest pointer-events-none" style={{ fontSize: 'clamp(5px, 0.4vw, 8px)' }}>WB</span>
                            <span className="absolute left-[8%] top-1/2 -translate-y-1/2 text-zinc-500 font-bold tracking-widest pointer-events-none" style={{ fontSize: 'clamp(5px, 0.4vw, 8px)' }}>{cameraMode === 'Av' ? 'AV-' : 'SS-'}</span>
                            <span className="absolute right-[8%] top-1/2 -translate-y-1/2 text-zinc-500 font-bold tracking-widest pointer-events-none" style={{ fontSize: 'clamp(5px, 0.4vw, 8px)' }}>{cameraMode === 'Av' ? 'AV+' : 'SS+'}</span>
                            
                            {/* Invisible directional buttons over the ring */}
                            <button onClick={() => {
                                if (activeSetting === 'ISO') setIsoIndex(i => Math.min(isoList.length - 1, i + 1))
                                else if (cameraMode === 'M') setApertureIndex(i => Math.min(apertureList.length - 1, i + 1))
                            }} className="absolute top-[15%] left-1/2 -translate-x-1/2 w-[30%] h-[25%] flex justify-center text-zinc-400 hover:text-white" style={{ fontSize: 'clamp(6px, 0.5vw, 10px)' }}>▲</button>
                            <button onClick={() => {
                                if (activeSetting === 'ISO') setIsoIndex(i => Math.max(0, i - 1))
                                else if (cameraMode === 'M') setApertureIndex(i => Math.max(0, i - 1))
                            }} className="absolute bottom-[15%] left-1/2 -translate-x-1/2 w-[30%] h-[25%] flex items-end justify-center text-zinc-400 hover:text-white" style={{ fontSize: 'clamp(6px, 0.5vw, 10px)' }}>▼</button>
                            <button onClick={() => {
                                if (cameraMode === 'Av') setApertureIndex(i => Math.max(0, i - 1))
                                else setShutterIndex(i => Math.max(0, i - 1))
                            }} className="absolute left-[15%] top-1/2 -translate-y-1/2 w-[25%] h-[30%] flex items-center justify-start text-zinc-400 hover:text-white" style={{ fontSize: 'clamp(6px, 0.5vw, 10px)' }}>◀</button>
                            <button onClick={() => {
                                if (cameraMode === 'Av') setApertureIndex(i => Math.min(apertureList.length - 1, i + 1))
                                else setShutterIndex(i => Math.min(shutterList.length - 1, i + 1))
                            }} className="absolute right-[15%] top-1/2 -translate-y-1/2 w-[25%] h-[30%] flex items-center justify-end text-zinc-400 hover:text-white" style={{ fontSize: 'clamp(6px, 0.5vw, 10px)' }}>▶</button>
                            
                            {/* Center SET button */}
                            <button onClick={() => setActiveSetting(p => p === 'ISO' ? null : 'ISO')}
                                className={`w-[35%] aspect-square rounded-full shadow-[0_2px_5px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.15)] active:translate-y-[1px] active:shadow-inner border border-[#444] font-bold flex items-center justify-center z-20 transition ${activeSetting === 'ISO' ? 'bg-yellow-600/30 text-yellow-400' : 'bg-[#2a2a2a] text-white'}`}
                                style={{ fontSize: 'clamp(7px, 0.6vw, 11px)' }}>
                                SET
                            </button>
                        </div>

                        {/* Playback Button */}
                        <div className="absolute bottom-[10%] right-[14%] w-[5%] aspect-[1.1/1] shadow-[inset_0_2px_5px_rgba(0,0,0,0.8)] flex items-center justify-center bg-[#111] border border-[#222] rounded z-10">
                            <button onClick={() => setIsGalleryOpen(true)}
                                className="w-[85%] h-[85%] rounded bg-[#2a2a2a] shadow-[0_2px_4px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.1)] active:translate-y-[2px] active:shadow-inner border border-[#444] text-white flex items-center justify-center">
                                <Play size="50%" fill="currentColor" />
                            </button>
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
