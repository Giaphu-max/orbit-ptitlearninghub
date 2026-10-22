import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { FLAGS, glStats } from '@/lib/perf'

/** Chỉ bật khi URL có ?perf: để đo trên máy thật (HUD DOM ở lib/perf). */
export const PERF_ON = FLAGS.perf

/** Phần GL của HUD: dpr hiện tại, số draw call, số tam giác, số đèn. Ghi vào glStats mỗi 0,5 giây (không qua state, không đụng DOM). */
export function PerfHud() {
    const gl = useThree((s) => s.gl)
    const scene = useThree((s) => s.scene)
    const acc = useRef(0)

    useFrame((_, delta) => {
        acc.current += delta
        if (acc.current < 0.5) return
        acc.current = 0
        let lights = 0
        scene.traverse((o) => {
            if ((o as THREE.Light).isLight) lights++
        })
        const { calls, triangles } = gl.info.render
        glStats.text = `dpr ${gl.getPixelRatio().toFixed(2)} · calls ${calls} · tris ${triangles} · đèn ${lights}`
    })
    return null
}
