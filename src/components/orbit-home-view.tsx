'use client'

import { Heart, MessageCircle, Share2, ChevronUp, ChevronDown, Play, MoreVertical } from 'lucide-react'

export function OrbitHomeView() {
    return (
        <main className="relative flex-1 h-full w-full flex items-center justify-center bg-[#f8f9fa] overflow-hidden m-0 p-0">
            {/* Decorative Background */}
            <div className="absolute -left-[100px] top-[20%] h-[400px] w-[400px] rounded-full bg-[#fdf0f2]" />
            <div className="absolute -bottom-[200px] -right-[100px] h-[700px] w-[700px] rounded-full bg-[#fdf0f2]" />

            {/* Main Layout Cluster */}
            <div className="z-10 flex flex-nowrap items-end justify-center gap-10 -translate-x-24">

                {/* Left Column (Text) */}
                <section className="flex flex-col justify-end w-[320px] shrink-0 self-end">
                    <div className="mb-4 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1e2329] text-sm font-bold text-white">
                            <img src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=100&q=80" alt="Dr. Sarah Chen" className="h-full w-full rounded-full object-cover" />
                        </div>
                        <div>
                            <p className="font-bold text-[#20242c]">Gia Phú</p>
                            <p className="text-xs font-medium text-[#777c86]">Instructor • 12m ago</p>
                        </div>
                    </div>

                    <h1 className="text-3xl font-bold tracking-tight text-[#20242c] leading-tight">
                        Molecular Dynamics in Real-time
                    </h1>

                    <p className="mt-4 text-sm leading-relaxed text-[#656a74]">
                        Explore the fascinating world of chemical reactions at a microscopic level. Lesson 4: Catalysts and Bond Energy.
                    </p>

                    <p className="mt-8 flex items-center gap-2 text-[10px] font-bold tracking-widest text-[#858a94] uppercase">
                        ♪ ORIGINAL AUDIO • Gia Phú
                    </p>
                </section>

                {/* Center Column (Video) */}
                <div className="relative aspect-[9/16] h-[97vh] max-h-[1100px] shrink-0 overflow-hidden rounded-[32px] bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.15)]">
                    {/* Abstract Glow */}
                    <div className="absolute -top-1/4 -right-1/4 h-[500px] w-[500px] rounded-full bg-indigo-500/20 blur-[100px]" />
                    <div className="absolute -bottom-1/4 -left-1/4 h-[400px] w-[400px] rounded-full bg-purple-500/20 blur-[80px]" />

                    {/* Play Badge */}
                    <div className="absolute inset-0 flex items-center justify-center z-10">
                        <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/10 shadow-2xl backdrop-blur-md transition hover:scale-105 cursor-pointer">
                            <Play size={36} fill="white" className="text-white ml-2" />
                        </div>
                    </div>

                    {/* Gradient Overlay */}
                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />

                    {/* Progress Bar */}
                    <div className="absolute inset-x-6 bottom-6 h-1 rounded-full bg-white/30">
                        <div className="h-full w-1/3 rounded-full bg-[#e72c38]" />
                    </div>
                </div>

                {/* Right Column (Actions) */}
                <aside className="flex w-[60px] shrink-0 flex-col items-center justify-end gap-6 self-end">
                    {/* App Icons */}
                    <div className="mb-2 flex flex-col gap-4">
                        <div className="h-14 w-14 rounded-xl bg-[#c7ad83] p-1.5 shadow-sm">
                            <div className="flex h-full items-center justify-center rounded-lg bg-[#152439] text-[10px] font-bold text-white">Ps</div>
                        </div>
                        <div className="h-14 w-14 rounded-xl bg-[#171e2b] p-1 shadow-sm">
                            <div className="flex h-full items-center justify-center rounded-lg bg-[#362b26] text-[10px] font-bold text-white">Pr</div>
                        </div>
                    </div>

                    <Action icon={<Heart size={32} strokeWidth={2.5} />} label="12.4K" />
                    <Action icon={<MessageCircle size={32} strokeWidth={2.5} />} label="842" />
                    <Action icon={<Share2 size={32} strokeWidth={2.5} />} label="Share" />

                    {/* Avatar bottom */}
                    <div className="mt-2 h-12 w-12 overflow-hidden rounded-full border-2 border-white shadow-md">
                        <img
                            src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=100&q=80"
                            alt="Avatar"
                            className="h-full w-full object-cover"
                        />
                    </div>
                </aside>

            </div>

            {/* Navigation Pill */}
            <div className="absolute right-8 top-1/2 flex -translate-y-1/2 flex-col items-center gap-3 z-20">
                <button type="button" className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-[#70747c] shadow-sm transition hover:bg-gray-50">
                    <ChevronUp size={32} strokeWidth={2.5} />
                </button>
                <button type="button" className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-[#70747c] shadow-sm transition hover:bg-gray-50">
                    <ChevronDown size={32} strokeWidth={2.5} />
                </button>
            </div>
        </main>
    )
}

function Action({ icon, label }: { icon: React.ReactNode; label: string }) {
    return (
        <button type="button" className="group flex flex-col items-center gap-2 text-[13px] font-semibold text-[#70747c] transition hover:text-[#20242c]">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-[#252932] shadow-sm transition group-hover:scale-105">
                {icon}
            </span>
            {label}
        </button>
    )
}
