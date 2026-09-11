import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Loader2 } from 'lucide-react'

interface OrbitProfileSetupModalProps {
    onComplete: () => void
}

export function OrbitProfileSetupModal({ onComplete }: OrbitProfileSetupModalProps) {
    const [username, setUsername] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const updateUsername = async (name: string) => {
        setIsSubmitting(true)
        setError(null)
        try {
            const { error: updateError } = await supabase.auth.updateUser({
                data: { username: name }
            })
            if (updateError) throw updateError
            onComplete()
        } catch (err: any) {
            console.error('Error updating username:', err)
            setError(err.message || 'Có lỗi xảy ra khi cập nhật tên hiển thị.')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!username.trim()) return
        updateUsername(username.trim())
    }

    const handleSkip = () => {
        const randomName = `user_${Math.floor(Math.random() * 100000)}`
        updateUsername(randomName)
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div 
                className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-8 pb-6 text-center">
                    <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl">👋</span>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight mb-2">Tạo tên hiển thị</h2>
                    <p className="text-gray-500 text-sm">
                        Hãy chọn một cái tên thật ngầu để mọi người có thể nhận ra bạn nhé.
                    </p>
                </div>
                
                <form onSubmit={handleSubmit} className="p-8 pt-0 flex flex-col gap-4">
                    <div>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Nhập tên hiển thị..."
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition-all font-medium text-gray-800 placeholder:text-gray-400 placeholder:font-normal"
                            disabled={isSubmitting}
                            autoFocus
                        />
                        {error && <p className="text-red-500 text-xs mt-2 font-medium">{error}</p>}
                    </div>

                    <div className="flex flex-col gap-2 mt-2">
                        <button
                            type="submit"
                            disabled={isSubmitting || !username.trim()}
                            className="w-full py-3.5 px-4 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center shadow-sm shadow-red-600/20"
                        >
                            {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : 'Xác nhận'}
                        </button>
                        <button
                            type="button"
                            onClick={handleSkip}
                            disabled={isSubmitting}
                            className="w-full py-3.5 px-4 rounded-xl font-semibold text-gray-600 hover:bg-gray-100 transition-colors flex items-center justify-center disabled:opacity-50"
                        >
                            Bỏ qua
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
