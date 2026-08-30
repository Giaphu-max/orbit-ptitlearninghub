import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface OrbitAuthModalProps {
  onClose: () => void
}

export function OrbitAuthModal({ onClose }: OrbitAuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setError('Vui lòng nhập email và mật khẩu.')
      return
    }

    setIsLoading(true)
    setError(null)
    setSuccessMsg(null)

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        onClose()
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setSuccessMsg('Đăng ký thành công! Bạn có thể đăng nhập ngay bây giờ (hoặc kiểm tra email nếu có xác nhận).')
        setMode('login')
      }
    } catch (err: any) {
      setError(err.message || 'Đã có lỗi xảy ra. Vui lòng thử lại.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <header className="flex h-16 items-center justify-between border-b border-[#e6e7ea] px-6">
          <h1 className="text-lg font-bold text-[#20242c]">
            {mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}
          </h1>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-[#42464e] transition hover:bg-[#f0f1f3]"
          >
            <X size={20} />
          </button>
        </header>

        {/* Body */}
        <div className="p-6">
          {/* Tabs */}
          <div className="mb-6 flex rounded-lg bg-[#f0f1f3] p-1">
            <button
              onClick={() => { setMode('login'); setError(null); setSuccessMsg(null); }}
              className={`flex-1 rounded-md py-2 text-sm font-semibold transition ${mode === 'login' ? 'bg-white text-[#d9232e] shadow-sm' : 'text-[#70747c]'}`}
            >
              Đăng nhập
            </button>
            <button
              onClick={() => { setMode('register'); setError(null); setSuccessMsg(null); }}
              className={`flex-1 rounded-md py-2 text-sm font-semibold transition ${mode === 'register' ? 'bg-white text-[#d9232e] shadow-sm' : 'text-[#70747c]'}`}
            >
              Đăng ký
            </button>
          </div>

          {/* Messages */}
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {successMsg && (
            <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
              {successMsg}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-sm font-semibold text-[#30343c]">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Nhập email..."
                className="h-12 w-full rounded-xl border border-[#e1e3e7] px-4 text-base outline-none transition focus:border-[#d9232e] focus:ring-2 focus:ring-[#d9232e]/10"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-[#30343c]">Mật khẩu</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu..."
                className="h-12 w-full rounded-xl border border-[#e1e3e7] px-4 text-base outline-none transition focus:border-[#d9232e] focus:ring-2 focus:ring-[#d9232e]/10"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#d9232e] text-base font-bold text-white transition hover:bg-[#b7131e] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading && <Loader2 size={18} className="animate-spin" />}
              {mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
