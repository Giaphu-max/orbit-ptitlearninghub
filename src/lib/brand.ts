// Logo thật của Học viện: ưu tiên bản webp nhẹ, rồi png/svg. Không có file thì các nơi dùng sẽ rơi về chữ PTIT.
const logoFiles = import.meta.glob('/src/assets/brand/logo.{webp,png,svg}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
export const LOGO_URL: string | undefined = logoFiles['/src/assets/brand/logo.webp'] ?? logoFiles['/src/assets/brand/logo.png'] ?? logoFiles['/src/assets/brand/logo.svg']

/** Logo Khoa Đa phương tiện (ribbon nhiều màu) */
export const FACULTY_LOGO_URL: string = new URL('../assets/brand/faculty-logo.png', import.meta.url).href

export const LOCKUP_URL: string = new URL('../assets/brand/lockup.svg', import.meta.url).href
