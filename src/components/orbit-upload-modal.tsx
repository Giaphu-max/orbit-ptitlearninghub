'use client'

import { useRef, useState } from 'react'
import { ArrowLeft, Check, Loader2, Play, X } from 'lucide-react'
import { uploadPost, type Post } from '../services/api'

interface OrbitUploadModalProps {
  onClose: () => void
  /** Called with the newly created post so the parent can append it to the feed. */
  onPostCreated?: (post: Post) => void
}

const SKILL_OPTIONS = ['Photoshop', 'Premiere Pro', 'After Effects', 'Motion', 'Blender', 'Figma', 'Cinema 4D', 'DaVinci Resolve']

export function OrbitUploadModal({ onClose, onPostCreated }: OrbitUploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<string[]>(['Photoshop', 'Premiere Pro'])
  const [tagSearch, setTagSearch] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // ── File selection ────────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  const handlePickerClick = () => fileInputRef.current?.click()

  // ── Tags ─────────────────────────────────────────────────────────────────
  const addTag = (tag: string) => {
    if (!tags.includes(tag)) setTags(prev => [...prev, tag])
    setTagSearch('')
  }

  const removeTag = (tag: string) => setTags(prev => prev.filter(t => t !== tag))

  const filteredSkills = SKILL_OPTIONS.filter(
    s => !tags.includes(s) && s.toLowerCase().includes(tagSearch.toLowerCase())
  )

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!selectedFile) {
      setErrorMessage('Vui lòng chọn một video trước khi chia sẻ.')
      return
    }
    if (!title.trim()) {
      setErrorMessage('Vui lòng nhập tiêu đề cho bài viết.')
      return
    }

    setIsUploading(true)
    setErrorMessage(null)

    try {
      const newPost = await uploadPost({ file: selectedFile, title: title.trim(), description, tags })
      onPostCreated?.(newPost)
      onClose()
    } catch (err: unknown) {
      const message = (err as { message?: string })?.message ?? 'Có lỗi xảy ra. Vui lòng thử lại.'
      setErrorMessage(message)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-title"
    >
      <div className="flex h-[750px] w-[1100px] max-w-[95vw] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#e6e7ea] px-6">
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ tạo bài viết"
            className="flex h-10 w-10 items-center justify-center rounded-full text-[#42464e] transition hover:bg-[#f0f1f3]"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 id="upload-title" className="text-lg font-bold text-[#20242c]">Tạo bài viết mới</h1>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isUploading}
            className="flex items-center gap-2 text-base font-bold text-[#d9232e] transition hover:text-[#b7131e] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isUploading && <Loader2 size={16} className="animate-spin" />}
            Chia sẻ
          </button>
        </header>

        {/* Error Toast */}
        {errorMessage && (
          <div className="mx-6 mt-4 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            <X size={16} className="shrink-0" />
            {errorMessage}
            <button type="button" onClick={() => setErrorMessage(null)} className="ml-auto shrink-0">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">

          {/* Left – Video Picker / Preview */}
          <section className="flex w-full items-center justify-center bg-[#f7f8fa] p-8 md:w-[45%]" aria-label="Video preview">
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={handlePickerClick}
              className="group relative flex h-full aspect-[9/16] w-full max-w-[340px] items-center justify-center overflow-hidden rounded-xl bg-[#e8eaed] text-[#777c86] shadow-sm transition hover:bg-[#dfe2e6]"
              aria-label="Chọn video"
            >
              {previewUrl ? (
                <video
                  src={previewUrl}
                  className="h-full w-full object-cover"
                  muted
                  loop
                  autoPlay
                  playsInline
                />
              ) : (
                <span className="flex flex-col items-center gap-4 text-sm font-medium">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-[#444952] shadow-sm transition group-hover:scale-105">
                    <Play size={28} fill="currentColor" className="ml-1" />
                  </span>
                  Nhấn để chọn video
                </span>
              )}
            </button>
          </section>

          {/* Right – Form */}
          <section className="flex w-full flex-col overflow-y-auto p-8 md:w-[55%]" aria-label="Post details">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#202328] text-sm font-bold text-white">GP</div>
              <span className="text-base font-bold text-[#242832]">Gia Phú</span>
            </div>

            {/* Title */}
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Tiêu đề bài viết..."
              className="mt-6 w-full border-0 p-0 text-xl font-bold text-[#20242c] outline-none placeholder:text-[#a1a6b0]"
            />

            {/* Description */}
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Viết mô tả..."
              className="mt-4 min-h-[100px] w-full resize-none border-0 p-0 text-base leading-relaxed text-[#444952] outline-none placeholder:text-[#a1a6b0]"
            />

            {/* Tags */}
            <div className="mt-8 border-t border-[#ececef] pt-8">
              <label htmlFor="skill-search" className="text-sm font-bold text-[#30343c]">
                Gắn thẻ kỹ năng
              </label>
              <input
                id="skill-search"
                value={tagSearch}
                onChange={e => setTagSearch(e.target.value)}
                placeholder="Tìm kỹ năng..."
                className="mt-4 h-12 w-full rounded-xl border border-[#e1e3e7] px-4 text-base text-[#343840] outline-none transition focus:border-[#d9232e] focus:ring-2 focus:ring-[#d9232e]/10"
              />

              {/* Dropdown suggestions */}
              {tagSearch && filteredSkills.length > 0 && (
                <div className="mt-1 rounded-xl border border-[#e1e3e7] bg-white shadow-lg overflow-hidden">
                  {filteredSkills.slice(0, 5).map(skill => (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => addTag(skill)}
                      className="w-full px-4 py-2.5 text-left text-sm text-[#343840] hover:bg-[#f7f8fa]"
                    >
                      {skill}
                    </button>
                  ))}
                </div>
              )}

              {/* Selected tags */}
              <div className="mt-4 flex flex-wrap gap-3">
                {tags.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-2 rounded-full bg-[#fff0ee] px-4 py-2 text-sm font-semibold text-[#b7131e]">
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)} aria-label={`Remove ${tag}`}>
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-auto flex items-center gap-2 pt-8 text-sm text-[#9297a1]">
              <Check size={18} /> Bài viết sẽ xuất hiện trong Discover
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
