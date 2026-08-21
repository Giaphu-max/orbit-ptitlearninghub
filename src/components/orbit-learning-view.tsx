'use client'

import { Check, Lock, Play } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const paths = [
    ['UI/UX Design', '12 / 24 bài học', '50%'], 
    ['3D Modeling', '8 / 20 bài học', '40%'], 
    ['Motion Design', '3 / 18 bài học', '17%']
]

export function OrbitLearningView() { 
    const navigate = useNavigate()
    return (
        <main className="relative flex-1 h-full w-full overflow-y-auto bg-[#f8f9fa] p-8">
            <div className="w-full">
                <h1 className="text-3xl font-bold text-[#20242c]">Deep Learning</h1>
                <p className="mt-2 text-[#747984]">Lộ trình học tập được thiết kế để bạn tiến bộ mỗi ngày.</p>
                
                <div className="mt-8 flex flex-col md:flex-row items-start gap-8">
                    <section className="w-full md:w-1/3 space-y-3">
                        {paths.map((path, i) => (
                            <article key={path[0]} className={`rounded-xl border bg-white p-4 shadow-sm ${i === 0 ? 'border-red-200 ring-1 ring-red-100' : 'border-gray-100'}`}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-semibold text-red-600">LỘ TRÌNH {i + 1}</p>
                                        <h2 className="mt-1 font-bold text-[#252932]">{path[0]}</h2>
                                    </div>
                                    <span className="text-sm font-bold text-[#5f6570]">{path[2]}</span>
                                </div>
                                <div className="mt-4 h-2 rounded-full bg-gray-100">
                                    <div className="h-full rounded-full bg-red-500" style={{ width: path[2] }} />
                                </div>
                                <p className="mt-2 text-xs text-gray-500">{path[1]}</p>
                            </article>
                        ))}
                    </section>
                    
                    <section className="w-full md:w-2/3 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-widest text-red-600">Lộ trình đang học</p>
                                <h2 className="mt-1 text-2xl font-bold text-[#20242c]">UI/UX Design từ cơ bản đến nâng cao</h2>
                            </div>
                            <span className="rounded-full bg-red-50 px-3 py-1 text-sm font-semibold text-red-600">50% hoàn thành</span>
                        </div>
                        
                        <div className="mt-8 space-y-5">
                            {['Tư duy thiết kế và nghiên cứu người dùng', 'Wireframe và information architecture', 'Thiết kế giao diện trong Figma', 'Prototype và usability testing'].map((item, i) => (
                                <div 
                                    key={item} 
                                    onClick={() => { if (i <= 2) navigate('/lesson') }}
                                    className={`flex items-center gap-4 border-b border-gray-100 p-3 -mx-3 ${i <= 2 ? 'cursor-pointer hover:bg-gray-50 rounded-xl transition border-transparent' : 'pb-5'}`}
                                >
                                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${i < 2 ? 'bg-emerald-100 text-emerald-600' : i === 2 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400'}`}>
                                        {i < 2 ? <Check size={17} /> : i === 2 ? <Play size={15} fill="currentColor" className="ml-0.5" /> : <Lock size={15} />}
                                    </span>
                                    <div className="flex-1">
                                        <h3 className={`font-semibold ${i === 2 ? 'text-red-700' : 'text-[#30343c]'}`}>{item}</h3>
                                        <p className="mt-1 text-sm text-gray-500">{i < 2 ? 'Đã hoàn thành' : i === 2 ? 'Đang học · 28 phút' : 'Bài học tiếp theo · 18 phút'}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </div>
        </main>
    )
}
