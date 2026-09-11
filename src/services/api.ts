import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Post {
  id: string
  title: string
  description?: string
  tags: string[]
  videoUrl: string
  thumbnailUrl?: string
  author: {
    id: string
    name: string
    avatarUrl?: string
  }
  likesCount: number
  commentsCount: number
  createdAt: string
}

export interface UploadPostPayload {
  file: File
  title: string
  description?: string
  tags: string[]
}

// ── Endpoints ─────────────────────────────────────────────────────────────────

export async function getPosts(currentUser?: User | null): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return data.map((post: any) => ({
    id: String(post.id),
    title: post.title,
    description: post.description,
    tags: post.tags || [],
    videoUrl: post.video_url,
    thumbnailUrl: post.thumbnail_url,
    author: {
      id: post.user_id || '1',
      name: (currentUser && currentUser.id === post.user_id && currentUser.user_metadata?.username)
        ? currentUser.user_metadata.username
        : 'Người dùng Orbit',
      avatarUrl: (currentUser && currentUser.id === post.user_id)
        ? currentUser.user_metadata?.avatar_url
        : undefined,
    },
    likesCount: post.likes_count || 0,
    commentsCount: post.comments_count || 0,
    createdAt: post.created_at,
  }))
}

export async function uploadPost(payload: UploadPostPayload): Promise<Post> {
  const fileExt = payload.file.name.split('.').pop()
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

  // 1. Get authenticated user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Bạn cần đăng nhập để tải lên video.')
  }

  // 2. Upload video
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('videos')
    .upload(fileName, payload.file)

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`)
  }

  // 3. Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('videos')
    .getPublicUrl(uploadData.path)

  // 4. Insert into posts table
  const { data: postData, error: insertError } = await supabase
    .from('posts')
    .insert({
      title: payload.title,
      description: payload.description,
      tags: payload.tags,
      video_url: publicUrl,
      user_id: user.id
    })
    .select()
    .single()

  if (insertError) {
    throw new Error(`Database insert failed: ${insertError.message}`)
  }

  return {
    id: String(postData.id),
    title: postData.title,
    description: postData.description,
    tags: postData.tags || [],
    videoUrl: postData.video_url,
    thumbnailUrl: postData.thumbnail_url,
    author: {
      id: user.id,
      name: user.user_metadata?.username || 'Người dùng Orbit',
      avatarUrl: user.user_metadata?.avatar_url,
    },
    likesCount: postData.likes_count || 0,
    commentsCount: postData.comments_count || 0,
    createdAt: postData.created_at,
  }
}
