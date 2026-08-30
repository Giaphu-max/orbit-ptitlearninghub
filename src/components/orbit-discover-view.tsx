'use client'

import { useEffect, useState } from 'react'
import { Heart } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getPosts, type Post } from '../services/api'

const TAGS = ['Tất cả', 'UI/UX Design', '3D Modeling', 'Photoshop', 'Premiere Pro', 'After Effects']

function SkeletonCard() {
  return (
    <div className="aspect-[9/16] overflow-hidden rounded-xl bg-gray-200 animate-pulse">
      <div className="h-full w-full" />
    </div>
  )
}

export function OrbitDiscoverView() {
  const [posts, setPosts] = useState<Post[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTag, setActiveTag] = useState('Tất cả')
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)

    getPosts()
      .then(data => { if (!cancelled) setPosts(data) })
      .catch((err: { message?: string }) => {
        if (!cancelled) setError(err?.message ?? 'Không thể tải bài viết. Vui lòng thử lại.')
      })
      .finally(() => { if (!cancelled) setIsLoading(false) })

    return () => { cancelled = true }
  }, [])

  const displayed = activeTag === 'Tất cả'
    ? posts
    : posts.filter(p => p.tags.some(t => t.toLowerCase() === activeTag.toLowerCase()))

  return (
    <main className="relative flex-1 h-full w-full overflow-y-auto bg-[#f8f9fa] p-8">
      <div className="w-full">

        {/* Filter Tabs */}
        <div className="mb-7 flex gap-2 overflow-x-auto pb-1">
          {TAGS.map((tag, i) => (
            <button
              key={tag}
              type="button"
              onClick={() => setActiveTag(tag)}
              className={`shrink-0 rounded-full px-5 py-2 text-sm font-semibold transition ${
                activeTag === tag || (i === 0 && activeTag === 'Tất cả')
                  ? 'bg-red-600 text-white'
                  : 'bg-white text-[#3e434c] shadow-sm hover:bg-gray-100'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Error State */}
        {error && !isLoading && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-base font-semibold text-[#d9232e]">{error}</p>
            <button
              type="button"
              onClick={() => { setError(null); setIsLoading(true); getPosts().then(setPosts).catch(() => setError('Không thể tải bài viết.')).finally(() => setIsLoading(false)) }}
              className="mt-4 rounded-full bg-red-600 px-6 py-2 text-sm font-bold text-white hover:bg-red-700"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* Post Grid */}
        <section className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5" aria-label="Post grid">
          {isLoading
            ? Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)
            : displayed.map(post => (
              <article 
                key={post.id} 
                className="relative aspect-[9/16] overflow-hidden rounded-xl bg-gray-300 cursor-pointer group"
                onClick={() => navigate(`/?videoId=${post.id}`)}
              >
                {/* Thumbnail or first-frame of video */}
                {post.thumbnailUrl
                  ? <img src={post.thumbnailUrl} alt={post.title} className="h-full w-full object-cover transition group-hover:scale-105" />
                  : (
                    <video
                      src={`${post?.videoUrl}#t=1.5`}
                      className="h-full w-full object-cover transition group-hover:scale-105"
                      muted
                      preload="metadata"
                    />
                  )
                }

                {/* Overlay */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-12 text-white">
                  <div className="flex items-end justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        {post.author.avatarUrl
                          ? <img src={post.author.avatarUrl} alt={post.author.name} className="h-6 w-6 rounded-full object-cover" />
                          : <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/80 text-[9px] font-bold text-gray-700">
                              {post.author.name.charAt(0).toUpperCase()}
                            </span>
                        }
                        <span className="text-xs">{post.author.name}</span>
                      </div>
                      <h2 className="mt-1 line-clamp-1 text-sm font-bold">{post.title}</h2>
                    </div>
                    <span className="flex shrink-0 items-center gap-1 text-xs">
                      <Heart size={14} fill="white" />
                      {post.likesCount >= 1000
                        ? `${(post.likesCount / 1000).toFixed(1)}K`
                        : post.likesCount}
                    </span>
                  </div>
                </div>
              </article>
            ))
          }
        </section>

        {/* Empty State */}
        {!isLoading && !error && displayed.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-base font-semibold text-[#777c86]">Chưa có bài viết nào cho danh mục này.</p>
          </div>
        )}
      </div>
    </main>
  )
}
