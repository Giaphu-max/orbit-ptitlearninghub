import { Color, MathUtils, MeshStandardMaterial } from 'three'
import { STUDIO } from '@/components/home/campus-palette'

// Vật thể của studio Virtual Director dùng chung: trang Studio (đơn vị mét) và cảnh match cut ở trang chủ (nhân hệ số).
// Mọi hình khối, kích thước, vị trí và màu lấy từ một chỗ này nên hai nơi luôn giống nhau.

/** Vật liệu của cảnh, tạo riêng cho từng canvas; màu gốc được pha theo môi trường (cảnh đêm thì sàn và vật thể tối đi). */
export type MaterialKey = 'floor' | 'wall' | 'plinth' | 'skin' | 'hair' | 'suit' | 'scarf' | 'propBlue' | 'propYellow' | 'propGreen' | 'column'

export const BASE_COLORS: Record<MaterialKey, { color: string; roughness: number; floor?: boolean; flat?: boolean }> = {
    floor: { color: STUDIO.floor, roughness: 0.9, floor: true },
    wall: { color: STUDIO.backdrop, roughness: 1 },
    plinth: { color: STUDIO.plinth, roughness: 0.6 },
    skin: { color: STUDIO.skin, roughness: 0.55, flat: true },
    hair: { color: STUDIO.hair, roughness: 0.8, flat: true },
    suit: { color: STUDIO.suit, roughness: 0.7, flat: true },
    scarf: { color: STUDIO.scarf, roughness: 0.8, flat: true },
    propBlue: { color: STUDIO.propBlue, roughness: 0.5 },
    propYellow: { color: STUDIO.propYellow, roughness: 0.4 },
    propGreen: { color: STUDIO.propGreen, roughness: 0.6 },
    column: { color: STUDIO.column, roughness: 0.8 },
}

export type Materials = Record<MaterialKey, MeshStandardMaterial>

export function createMaterials(): Materials {
    const out = {} as Materials
    for (const key of Object.keys(BASE_COLORS) as MaterialKey[]) {
        out[key] = new MeshStandardMaterial({ color: BASE_COLORS[key].color, roughness: BASE_COLORS[key].roughness, flatShading: BASE_COLORS[key].flat ?? false })
    }
    return out
}


/** Vị trí các vật thể phụ quanh chủ thể (mét). Tâm của từng khối, y đã tính nửa chiều cao. */
export const STUDIO_PROP_AT = {
    blue: [-1.7, 0.4, -0.6],
    yellow: [1.5, 0.35, 0.2],
    green: [2.3, 0.9, -1.4],
    column: [-2.8, 1.2, -2.4],
} as const

/** Bục đỏ dưới chân nhân vật */
export function StudioPlinth({ mats }: { mats: Materials }) {
    return (
        <group>
            <mesh position={[0, 0.06, 0]} receiveShadow castShadow>
                <cylinderGeometry args={[0.7, 0.8, 0.12, 40]} />
                <primitive object={mats.plinth} attach="material" />
            </mesh>
        </group>
    )
}

/** Nhân vật low-poly (mặt hướng +z, về phía máy ảnh), đứng trên bục */
export function StudioFigure({ mats }: { mats: Materials }) {
    return (
        <group>
            {/* Nhân vật low-poly: thân, vai, tay, cổ, đầu (mặt hướng +z, về phía máy ảnh), tóc, khăn đỏ */}
            <group>
                <mesh position={[0, 0.57, 0]} castShadow receiveShadow>
                    <cylinderGeometry args={[0.28, 0.32, 0.9, 8]} />
                    <primitive object={mats.suit} attach="material" />
                </mesh>
                <mesh position={[0, 1.28, 0]} castShadow receiveShadow>
                    <cylinderGeometry args={[0.4, 0.28, 0.58, 8]} />
                    <primitive object={mats.suit} attach="material" />
                </mesh>
                <mesh position={[0, 1.57, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
                    <capsuleGeometry args={[0.13, 0.74, 3, 8]} />
                    <primitive object={mats.suit} attach="material" />
                </mesh>
                {[-1, 1].map((side) => (
                    <mesh key={side} position={[side * 0.53, 1.12, 0]} rotation={[0, 0, side * 0.08]} castShadow receiveShadow>
                        <cylinderGeometry args={[0.09, 0.075, 0.8, 6]} />
                        <primitive object={mats.suit} attach="material" />
                    </mesh>
                ))}
                <mesh position={[0, 1.72, 0]} castShadow receiveShadow>
                    <cylinderGeometry args={[0.085, 0.1, 0.2, 8]} />
                    <primitive object={mats.skin} attach="material" />
                </mesh>
                <mesh position={[0, 1.68, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                    <torusGeometry args={[0.17, 0.06, 6, 12]} />
                    <primitive object={mats.scarf} attach="material" />
                </mesh>
                <mesh position={[0, 1.94, 0]} castShadow receiveShadow>
                    <icosahedronGeometry args={[0.24, 1]} />
                    <primitive object={mats.skin} attach="material" />
                </mesh>
                <mesh position={[0, 1.97, -0.03]} rotation={[-0.25, 0, 0]} castShadow>
                    <sphereGeometry args={[0.26, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
                    <primitive object={mats.hair} attach="material" />
                </mesh>
                {[-1, 1].map((side) => (
                    <mesh key={side} position={[side * 0.085, 1.95, 0.215]}>
                        <sphereGeometry args={[0.027, 6, 6]} />
                        <primitive object={mats.hair} attach="material" />
                    </mesh>
                ))}
                <mesh position={[0, 1.9, 0.235]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                    <coneGeometry args={[0.035, 0.07, 4]} />
                    <primitive object={mats.skin} attach="material" />
                </mesh>
            </group>
        </group>
    )
}

/** Các vật thể phụ, mỗi cái một mesh đặt tại gốc của nó (bọc trong group để đặt vị trí/scale). */
export function PropBlue({ mats }: { mats: Materials }) {
    return (
        <mesh castShadow receiveShadow>
            <boxGeometry args={[0.8, 0.8, 0.8]} />
            <primitive object={mats.propBlue} attach="material" />
        </mesh>
    )
}
export function PropYellow({ mats }: { mats: Materials }) {
    return (
        <mesh castShadow receiveShadow>
            <sphereGeometry args={[0.35, 32, 32]} />
            <primitive object={mats.propYellow} attach="material" />
        </mesh>
    )
}
export function PropGreen({ mats }: { mats: Materials }) {
    return (
        <mesh castShadow receiveShadow>
            <cylinderGeometry args={[0.28, 0.28, 1.8, 32]} />
            <primitive object={mats.propGreen} attach="material" />
        </mesh>
    )
}
export function PropColumn({ mats }: { mats: Materials }) {
    return (
        <mesh castShadow receiveShadow>
            <cylinderGeometry args={[0.35, 0.35, 2.4, 32]} />
            <primitive object={mats.column} attach="material" />
        </mesh>
    )
}

/** Bốn mặt phông quanh studio (sàn do trang gọi tự dựng). */
export function StudioWalls({ mats }: { mats: Materials }) {
    return (
        <group>
            {/* Phông cong sau lưng chủ thể */}
            <mesh position={[0, 3.5, -4.5]} receiveShadow material={mats.wall}>
                <planeGeometry args={[18, 8]} />
            </mesh>
            <mesh position={[0, 3.5, 4.5]} rotation={[0, Math.PI, 0]} material={mats.wall}>
                <planeGeometry args={[18, 8]} />
            </mesh>
            <mesh position={[-6, 3.5, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow material={mats.wall}>
                <planeGeometry args={[18, 8]} />
            </mesh>
            <mesh position={[6, 3.5, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow material={mats.wall}>
                <planeGeometry args={[18, 8]} />
            </mesh>
        </group>
    )
}


const luminance = (c: Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b
const DEFAULT_LUMINANCE = luminance(new Color(STUDIO.backdrop))

/** Pha màu vật thể theo màu nền: nền càng tối (cảnh đêm) thì sàn và vật thể càng tối, hơi ngả về màu nền. */
export function tintMaterials(mats: Materials, background: Color) {
    const tone = MathUtils.clamp(luminance(background) / DEFAULT_LUMINANCE, 0, 1)
    for (const key of Object.keys(BASE_COLORS) as MaterialKey[]) {
        const base = BASE_COLORS[key]
        if (key === 'wall') {
            mats.wall.color.copy(background)
            continue
        }
        const gain = base.floor ? 0.15 + 0.85 * tone : 0.5 + 0.5 * tone
        mats[key].color.set(base.color).multiplyScalar(gain).lerp(background, base.floor ? 0.3 : 0.12)
    }
}
