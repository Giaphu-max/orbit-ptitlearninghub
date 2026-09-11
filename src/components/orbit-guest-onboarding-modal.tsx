import { useState } from 'react'
import { X, Check } from 'lucide-react'

interface OrbitGuestOnboardingModalProps {
    onClose: () => void
}

const SKILLS = [
    { id: 'uiux', label: 'UI/UX Design', icon: '🎨' },
    { id: '3d', label: '3D Modeling', icon: '🧊' },
    { id: 'photo', label: 'Photography', icon: '📸' },
    { id: 'code', label: 'Coding', icon: '💻' },
    { id: 'video', label: 'Videography', icon: '🎥' },
    { id: 'illustration', label: 'Illustration', icon: '🖌️' },
]

export function OrbitGuestOnboardingModal({ onClose }: OrbitGuestOnboardingModalProps) {
    const [selectedSkills, setSelectedSkills] = useState<string[]>([])

    const toggleSkill = (id: string) => {
        setSelectedSkills(prev => 
            prev.includes(id) 
                ? prev.filter(s => s !== id)
                : [...prev, id]
        )
    }

    const handleComplete = () => {
        localStorage.setItem('orbit_guest_onboarded', 'true')
        onClose()
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div 
                className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-6 pb-2">
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Chào mừng đến với Orbit!</h2>
                    <button 
                        onClick={handleComplete} 
                        className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-500"
                        title="Bỏ qua"
                    >
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-6 pt-2">
                    <p className="text-gray-500 text-sm mb-6">
                        Để mang đến trải nghiệm tốt nhất, hãy chọn những lĩnh vực bạn quan tâm dưới đây nhé.
                    </p>

                    <div className="grid grid-cols-2 gap-3 mb-8">
                        {SKILLS.map(skill => {
                            const isSelected = selectedSkills.includes(skill.id)
                            return (
                                <button
                                    key={skill.id}
                                    onClick={() => toggleSkill(skill.id)}
                                    className={`relative flex items-center gap-3 p-4 rounded-2xl border-2 transition-all duration-200 text-left overflow-hidden group ${
                                        isSelected 
                                            ? 'border-red-500 bg-red-50 shadow-sm' 
                                            : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                                    }`}
                                >
                                    <span className="text-2xl">{skill.icon}</span>
                                    <span className={`font-medium text-sm transition-colors ${isSelected ? 'text-red-700' : 'text-gray-700'}`}>
                                        {skill.label}
                                    </span>
                                    {isSelected && (
                                        <div className="absolute top-2 right-2 text-red-500">
                                            <Check size={16} strokeWidth={3} />
                                        </div>
                                    )}
                                </button>
                            )
                        })}
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleComplete}
                            className="flex-1 py-3.5 px-4 rounded-xl font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                        >
                            Bỏ qua
                        </button>
                        <button
                            onClick={handleComplete}
                            disabled={selectedSkills.length === 0}
                            className={`flex-[2] py-3.5 px-4 rounded-xl font-semibold text-white transition-all duration-200 shadow-sm ${
                                selectedSkills.length > 0
                                    ? 'bg-red-600 hover:bg-red-700 shadow-red-600/20'
                                    : 'bg-gray-300 cursor-not-allowed'
                            }`}
                        >
                            Bắt đầu khám phá
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
