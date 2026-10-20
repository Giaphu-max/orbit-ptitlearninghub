import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/** Tên bài rút gọn cho chỗ hẹp (chip nguồn): dùng shortTitle nếu có, không thì cắt ở ranh giới từ. */
export function lessonShortTitle(lesson: { title: string; shortTitle?: string }, maxWords = 5) {
  if (lesson.shortTitle) return lesson.shortTitle
  const words = lesson.title.split(/\s+/)
  return words.length > maxWords ? `${words.slice(0, maxWords).join(' ')}…` : lesson.title
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
