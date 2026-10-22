import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'

/** Chỉ bật khi URL có ?perf: để đo trên máy thật. */
export const PERF_ON = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('perf')

/** Góc màn hình: FPS, dpr hiện tại, số draw call, số tam giác, số đèn. Ghi thẳng DOM mỗi 0,5 giây (không qua state). */
export function PerfHud() {
    const gl = useThree((s) => s.gl)
    const scene = useThree((s) => s.scene)
    const el = useRef<HTMLDivElement | null>(null)
    const acc = useRef({ t: 0, n: 0 })

    useEffect(() => {
        const d = document.createElement('div')
        d.setAttribute('aria-hidden', 'true')
        d.style.cssText = 'position:fixed;left:8px;top:8px;z-index:9999;padding:6px 8px;border-radius:6px;background:rgba(0,0,0,.72);color:#fff;font:11px/1.45 ui-monospace,Menlo,monospace;pointer-events:none;white-space:pre'
        document.body.appendChild(d)
        el.current = d
        return () => {
            d.remove()
            el.current = null
        }
    }, [])

    useFrame((_, delta) => {
        const a = acc.current
        a.t += delta
        a.n++
        if (a.t < 0.5 || !el.current) return
        let lights = 0
        scene.traverse((o) => {
            if ((o as THREE.Light).isLight) lights++
        })
        const { calls, triangles } = gl.info.render
        el.current.textContent = `${Math.round(a.n / a.t)} fps\ndpr ${gl.getPixelRatio().toFixed(2)}\ncalls ${calls}\ntris ${triangles}\nlights ${lights}`
        a.t = 0
        a.n = 0
    })
    return null
}
