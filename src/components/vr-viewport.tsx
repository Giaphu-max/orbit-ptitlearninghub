'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js'
import { FilmPass } from 'three/examples/jsm/postprocessing/FilmPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js'
import { VignetteShader } from 'three/examples/jsm/shaders/VignetteShader.js'
import { Maximize, Minimize, MousePointerClick } from 'lucide-react'

interface LightState {
  id: string
  label: string
  brightness: number
  color: string
  position: THREE.Vector3
}

interface VRViewportProps {
  focalLength: number
  iso: number
  shutter: string
  aperture: string
  lights: LightState[]
  onLightsChange: (lights: LightState[]) => void
  onFocalLengthChange?: (value: number) => void
  onSnapshot?: (dataUrl: string, timestamp: string) => void
  onSnapshotTriggerReady?: (fn: () => void) => void
}

interface PopupState {
  lightId: string
  screenX: number
  screenY: number
}

// ─── Mannequin builder ────────────────────────────────────────────────────────
function buildMannequin(scene: THREE.Scene) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xf0ede8, roughness: 0.55, metalness: 0.05 })
  const parts: [THREE.BufferGeometry, [number, number, number], [number, number, number]?][] = [
    // Head
    [new THREE.SphereGeometry(0.13, 24, 24), [0, 1.78, 0]],
    // Neck
    [new THREE.CylinderGeometry(0.05, 0.06, 0.12, 16), [0, 1.6, 0]],
    // Torso upper
    [new THREE.CylinderGeometry(0.17, 0.22, 0.42, 20), [0, 1.35, 0]],
    // Torso lower
    [new THREE.CylinderGeometry(0.22, 0.19, 0.28, 20), [0, 1.02, 0]],
    // Hips
    [new THREE.CylinderGeometry(0.21, 0.2, 0.18, 20), [0, 0.82, 0]],
    // Left upper arm
    [new THREE.CylinderGeometry(0.055, 0.05, 0.3, 14), [-0.29, 1.35, 0], [0, 0, 0.35]],
    // Left lower arm
    [new THREE.CylinderGeometry(0.045, 0.04, 0.28, 14), [-0.38, 1.06, 0], [0, 0, 0.28]],
    // Right upper arm
    [new THREE.CylinderGeometry(0.055, 0.05, 0.3, 14), [0.29, 1.35, 0], [0, 0, -0.35]],
    // Right lower arm
    [new THREE.CylinderGeometry(0.045, 0.04, 0.28, 14), [0.38, 1.06, 0], [0, 0, -0.28]],
    // Left thigh
    [new THREE.CylinderGeometry(0.1, 0.085, 0.38, 16), [-0.1, 0.55, 0]],
    // Left shin
    [new THREE.CylinderGeometry(0.075, 0.06, 0.36, 16), [-0.1, 0.18, 0]],
    // Left foot
    [new THREE.BoxGeometry(0.1, 0.07, 0.22), [-0.1, 0.035, 0.06]],
    // Right thigh
    [new THREE.CylinderGeometry(0.1, 0.085, 0.38, 16), [0.1, 0.55, 0]],
    // Right shin
    [new THREE.CylinderGeometry(0.075, 0.06, 0.36, 16), [0.1, 0.18, 0]],
    // Right foot
    [new THREE.BoxGeometry(0.1, 0.07, 0.22), [0.1, 0.035, 0.06]],
  ]
  parts.forEach(([geo, pos, rot]) => {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(...pos)
    if (rot) m.rotation.set(...rot)
    m.castShadow = true
    m.receiveShadow = true
    scene.add(m)
  })

  // Pedestal
  const pedGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.06, 32)
  const pedMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.4 })
  const ped = new THREE.Mesh(pedGeo, pedMat)
  ped.position.set(0, 0.03, 0)
  ped.receiveShadow = true
  scene.add(ped)
}

// ─── Light stand builder ──────────────────────────────────────────────────────
interface StandResult {
  spotLight: THREE.SpotLight
  interactMesh: THREE.Mesh
}

function buildLightStand(
  scene: THREE.Scene,
  id: string,
  position: [number, number, number],
  targetPos: [number, number, number],
  initialColor: string,
  initialIntensity: number
): StandResult {
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.7, roughness: 0.3 })
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.9, roughness: 0.15 })

  // Stand pole
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 2.0, 12), darkMat)
  pole.position.set(position[0], 1.0, position[2])
  pole.castShadow = true
  scene.add(pole)

  // Base
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.06, 24), darkMat)
  base.position.set(position[0], 0.03, position[2])
  scene.add(base)

  // Lamp housing (clickable)
  const housingGeo = new THREE.CylinderGeometry(0.14, 0.08, 0.28, 20, 1, true)
  const housingMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.6, roughness: 0.3, side: THREE.DoubleSide })
  const housing = new THREE.Mesh(housingGeo, housingMat)
  housing.name = id
  housing.position.set(position[0], 2.0, position[2])
  // Tilt toward the mannequin
  const dx = targetPos[0] - position[0]
  const dz = targetPos[2] - position[2]
  housing.rotation.z = Math.atan2(dx, 2.0) * 0.6
  housing.rotation.x = Math.atan2(dz, 2.0) * 0.6
  housing.castShadow = true
  scene.add(housing)

  // Emissive lens
  const lensMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(initialColor),
    emissive: new THREE.Color(initialColor),
    emissiveIntensity: 0.9,
  })
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.08, 24), lensMat)
  lens.position.copy(housing.position)
  lens.position.y -= 0.14
  lens.name = `${id}-lens`
  scene.add(lens)

  // Arm connecting pole to housing
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.25, 8), chromeMat)
  arm.position.set(position[0], 1.88, position[2])
  arm.rotation.z = Math.PI * 0.08
  scene.add(arm)

  // SpotLight
  const spot = new THREE.SpotLight(new THREE.Color(initialColor), initialIntensity * 80, 12, Math.PI / 6, 0.3, 1.5)
  spot.position.set(...position)
  spot.castShadow = true
  spot.shadow.mapSize.set(1024, 1024)
  spot.shadow.camera.near = 0.5
  spot.shadow.camera.far = 14
  spot.shadow.bias = -0.001

  const target = new THREE.Object3D()
  target.position.set(...targetPos)
  scene.add(target)
  spot.target = target
  scene.add(spot)

  return { spotLight: spot, interactMesh: housing }
}

// ─── Component ────────────────────────────────────────────────────────────────
export function VRViewport({ focalLength, iso, shutter, aperture, lights, onLightsChange, onFocalLengthChange, onSnapshot, onSnapshotTriggerReady }: VRViewportProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const composerRef = useRef<EffectComposer | null>(null)
  const bokehPassRef = useRef<BokehPass | null>(null)
  const filmPassRef = useRef<FilmPass | null>(null)
  const animFrameRef = useRef<number>(0)
  const keysRef = useRef<Set<string>>(new Set())
  const yawRef = useRef(0)
  const pitchRef = useRef(0)

  // Light tracking
  const spotLightsRef = useRef<Map<string, THREE.SpotLight>>(new Map())
  const lensesRef = useRef<Map<string, THREE.Mesh>>(new Map())
  const interactMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map())
  const teleportRingsRef = useRef<THREE.Mesh[]>([])
  const raycasterRef = useRef(new THREE.Raycaster())
  const centerVec2 = useRef(new THREE.Vector2(0, 0))
  const hoveredObjectRef = useRef<string | null>(null)

  const [popup, setPopup] = useState<PopupState | null>(null)
  const [fps, setFps] = useState(60)
  const [isPointerLocked, setIsPointerLocked] = useState(false)
  const afReticleRef = useRef<THREE.LineSegments | null>(null)
  const afTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [focusDistance, setFocusDistance] = useState(5.0)
  const [hasEnteredOnce, setHasEnteredOnce] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [hoveredInteractable, setHoveredInteractable] = useState<'light' | 'ring' | null>(null)
  const [flashActive, setFlashActive] = useState(false)
  const rightMouseDownRef = useRef(false)

  const teleportPositions = [
    new THREE.Vector3(0, 0, 3.5),
    new THREE.Vector3(-2.5, 0, 0),
    new THREE.Vector3(2.5, 0, 0),
    new THREE.Vector3(0, 0, -4),
  ]

  const buildScene = useCallback((scene: THREE.Scene) => {
    // ── Background & fog ────────────────────────────────────────────────────
    scene.background = new THREE.Color(0xd6d6d6)
    scene.fog = new THREE.FogExp2(0xd6d6d6, 0.025)

    // ── Floor ───────────────────────────────────────────────────────────────
    const floorGeo = new THREE.PlaneGeometry(22, 30)
    const floorMat = new THREE.MeshStandardMaterial({ color: 0xe2e0dc, roughness: 0.85 })
    const floor = new THREE.Mesh(floorGeo, floorMat)
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    scene.add(floor)

    // Floor grid lines (subtle)
    const gridHelper = new THREE.GridHelper(22, 22, 0xbcbcbc, 0xbcbcbc)
    gridHelper.position.y = 0.001
    ;(gridHelper.material as THREE.Material).transparent = true
    ;(gridHelper.material as THREE.Material).opacity = 0.4
    scene.add(gridHelper)

    // ── Walls ───────────────────────────────────────────────────────────────
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xeeebe6, roughness: 0.9 })

    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(22, 5), wallMat)
    backWall.position.set(0, 2.5, -15)
    backWall.receiveShadow = true
    scene.add(backWall)

    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(30, 5), wallMat)
    leftWall.rotation.y = Math.PI / 2
    leftWall.position.set(-11, 2.5, 0)
    leftWall.receiveShadow = true
    scene.add(leftWall)

    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(30, 5), wallMat)
    rightWall.rotation.y = -Math.PI / 2
    rightWall.position.set(11, 2.5, 0)
    rightWall.receiveShadow = true
    scene.add(rightWall)

    // Ceiling
    const ceilMat = new THREE.MeshStandardMaterial({ color: 0xf5f3f0, roughness: 0.9 })
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(22, 30), ceilMat)
    ceiling.rotation.x = Math.PI / 2
    ceiling.position.set(0, 5, 0)
    ceiling.receiveShadow = true
    scene.add(ceiling)

    // ── Backdrop sweep (seamless floor-to-wall curve look) ──────────────────
    const sweepGeo = new THREE.PlaneGeometry(10, 5)
    const sweepMat = new THREE.MeshStandardMaterial({ color: 0xe8e4de, roughness: 0.95 })
    const sweep = new THREE.Mesh(sweepGeo, sweepMat)
    sweep.position.set(0, 2.5, -7)
    sweep.receiveShadow = true
    scene.add(sweep)

    // ── Mannequin ───────────────────────────────────────────────────────────
    buildMannequin(scene)

    // ── Studio light stands ─────────────────────────────────────────────────
    // Key light
    const { spotLight: keySpot, interactMesh: keyMesh } = buildLightStand(
      scene, 'key', [5, 5, 5], [0, 1.2, 0], '#ffffff', 1.0
    )
    spotLightsRef.current.set('key', keySpot)
    interactMeshesRef.current.set('key', keyMesh)

    // Fill light
    const { spotLight: fillSpot, interactMesh: fillMesh } = buildLightStand(
      scene, 'fill', [-5, 3, 5], [0, 1.2, 0], '#ffffee', 0.5
    )
    spotLightsRef.current.set('fill', fillSpot)
    interactMeshesRef.current.set('fill', fillMesh)

    // Rim light
    const { spotLight: rimSpot, interactMesh: rimMesh } = buildLightStand(
      scene, 'rim', [0, 5, -5], [0, 1.4, 0], '#aaddff', 0.8
    )
    spotLightsRef.current.set('rim', rimSpot)
    interactMeshesRef.current.set('rim', rimMesh)

    // Collect lens meshes for glow sync
    scene.traverse(obj => {
      if (obj instanceof THREE.Mesh && obj.name.endsWith('-lens')) {
        const id = obj.name.replace('-lens', '')
        lensesRef.current.set(id, obj)
      }
    })

    // ── Ambient fill ────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 0.1))

    // ── Teleport rings ──────────────────────────────────────────────────────
    teleportPositions.forEach(pos => {
      const ringMat = new THREE.MeshStandardMaterial({
        color: 0xe63946, emissive: 0xe63946, emissiveIntensity: 0.7, metalness: 0.4,
      })
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.03, 16, 64), ringMat)
      ring.rotation.x = -Math.PI / 2
      ring.position.copy(pos)
      ring.position.y = 0.015
      scene.add(ring)
      teleportRingsRef.current.push(ring)

      const dotMat = new THREE.MeshStandardMaterial({ color: 0xe63946, emissive: 0xe63946, emissiveIntensity: 1.0 })
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.07, 32), dotMat)
      dot.rotation.x = -Math.PI / 2
      dot.position.copy(pos)
      dot.position.y = 0.02
      scene.add(dot)
    })

    // ── AF Reticle ──────────────────────────────────────────────────────────
    const afGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.15, 0.15, 0), new THREE.Vector3(0.15, 0.15, 0),
      new THREE.Vector3(0.15, 0.15, 0), new THREE.Vector3(0.15, -0.15, 0),
      new THREE.Vector3(0.15, -0.15, 0), new THREE.Vector3(-0.15, -0.15, 0),
      new THREE.Vector3(-0.15, -0.15, 0), new THREE.Vector3(-0.15, 0.15, 0)
    ])
    const afMat = new THREE.LineBasicMaterial({ color: 0x00FF00, depthTest: false })
    const afMesh = new THREE.LineSegments(afGeo, afMat)
    afMesh.renderOrder = 999
    afMesh.visible = false
    scene.add(afMesh)
    afReticleRef.current = afMesh

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Main Three.js setup ───────────────────────────────────────────────────
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const w = mount.clientWidth, h = mount.clientHeight

    const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(w, h)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.outputColorSpace = THREE.SRGBColorSpace
    mount.appendChild(renderer.domElement)
    rendererRef.current = renderer

    const scene = new THREE.Scene()
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(70, w / h, 0.1, 60)
    camera.position.set(0, 1.65, 5)
    cameraRef.current = camera

    const composer = new EffectComposer(renderer)
    const renderPass = new RenderPass(scene, camera)
    composer.addPass(renderPass)

    const bokehPass = new BokehPass(scene, camera, {
      focus: 5.0,
      aperture: 0.00001,
      maxblur: 0.015,
      width: w,
      height: h
    })
    composer.addPass(bokehPass)
    bokehPassRef.current = bokehPass

    const filmPass = new FilmPass(0.0, 0, 0, false)
    composer.addPass(filmPass)
    filmPassRef.current = filmPass

    const vignettePass = new ShaderPass(VignetteShader)
    vignettePass.uniforms['offset'].value = 0.1
    vignettePass.uniforms['darkness'].value = 1.1
    composer.addPass(vignettePass)

    const outputPass = new OutputPass()
    composer.addPass(outputPass)

    const smaaPass = new SMAAPass(w * renderer.getPixelRatio(), h * renderer.getPixelRatio())
    composer.addPass(smaaPass)

    composerRef.current = composer

    buildScene(scene)

    let lastTime = performance.now(), frameCount = 0
    const moveSpeed = 0.055

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate)
      frameCount++
      const now = performance.now()
      if (now - lastTime > 500) {
        setFps(Math.round((frameCount * 1000) / (now - lastTime)))
        frameCount = 0; lastTime = now
      }

      const forward = new THREE.Vector3(), right = new THREE.Vector3()
      camera.getWorldDirection(forward); forward.y = 0; forward.normalize()
      right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()

      if (keysRef.current.has('w') || keysRef.current.has('arrowup')) camera.position.addScaledVector(forward, moveSpeed)
      if (keysRef.current.has('s') || keysRef.current.has('arrowdown')) camera.position.addScaledVector(forward, -moveSpeed)
      if (keysRef.current.has('a') || keysRef.current.has('arrowleft')) camera.position.addScaledVector(right, -moveSpeed)
      if (keysRef.current.has('d') || keysRef.current.has('arrowright')) camera.position.addScaledVector(right, moveSpeed)

      camera.position.x = Math.max(-10, Math.min(10, camera.position.x))
      camera.position.z = Math.max(-13, Math.min(7, camera.position.z))
      camera.position.y = 1.65
      camera.rotation.set(pitchRef.current, yawRef.current, 0, 'YXZ')

      // Animate teleport rings
      teleportRingsRef.current.forEach(r => { r.rotation.z += 0.008 })

      // Continuous hover raycast
      raycasterRef.current.setFromCamera(centerVec2.current, camera)
      const iMeshes = [...interactMeshesRef.current.values()]
      const lHits = raycasterRef.current.intersectObjects(iMeshes)
      const rHits = raycasterRef.current.intersectObjects(teleportRingsRef.current)
      if (lHits.length > 0 && lHits[0].distance < 10) {
        const n = lHits[0].object.name
        if (hoveredObjectRef.current !== n) { hoveredObjectRef.current = n; setHoveredInteractable('light') }
      } else if (rHits.length > 0 && rHits[0].distance < 12) {
        if (hoveredObjectRef.current !== 'ring') { hoveredObjectRef.current = 'ring'; setHoveredInteractable('ring') }
      } else {
        if (hoveredObjectRef.current !== null) { hoveredObjectRef.current = null; setHoveredInteractable(null) }
      }

      composer.render()
    }
    animate()

    const onResize = () => {
      const nw = mount.clientWidth, nh = mount.clientHeight
      renderer.setSize(nw, nh); composer.setSize(nw, nh); camera.aspect = nw / nh; camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(animFrameRef.current)
      renderer.dispose()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
      window.removeEventListener('resize', onResize)
    }
  }, [buildScene])

  // Expose snapshot trigger to parent (for SHUTTER button)
  useEffect(() => {
    onSnapshotTriggerReady?.(() => {
      const renderer = rendererRef.current
      const composer = composerRef.current
      if (!renderer || !sceneRef.current || !cameraRef.current || !composer) return
      
      requestAnimationFrame(() => {
        const reticleVisible = afReticleRef.current ? afReticleRef.current.visible : false
        if (afReticleRef.current) afReticleRef.current.visible = false
        
        composer.render()
        const dataUrl = renderer.domElement.toDataURL('image/png')
        
        if (afReticleRef.current) afReticleRef.current.visible = reticleVisible
        
        const now = new Date()
        const ts = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`
        setFlashActive(true)
        setTimeout(() => setFlashActive(false), 350)
        playShutter()
        onSnapshot?.(dataUrl, ts)
      })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onSnapshotTriggerReady])

  // ── Sync lights from external state ───────────────────────────────────────
  useEffect(() => {
    lights.forEach(light => {
      const spot = spotLightsRef.current.get(light.id)
      if (spot) {
        spot.intensity = light.brightness * 80
        spot.color = new THREE.Color(light.color)
      }
      const lens = lensesRef.current.get(light.id)
      if (lens && lens.material instanceof THREE.MeshStandardMaterial) {
        lens.material.color = new THREE.Color(light.color)
        lens.material.emissive = new THREE.Color(light.color)
        lens.material.emissiveIntensity = light.brightness * 0.9
      }
    })
  }, [lights])

  // ── Sync Exposure & DOF ───────────────────────────────────────────────────
  useEffect(() => {
    if (!rendererRef.current || !bokehPassRef.current || !filmPassRef.current) return

    // 1. Calculate Exposure
    const parseShutter = (s: string) => {
      if (s.includes('"')) return parseFloat(s)
      if (s.includes('/')) {
        const [num, den] = s.split('/')
        return parseFloat(num) / parseFloat(den)
      }
      return parseFloat(s)
    }
    
    const isoMult = iso / 100
    const cleanAperture = parseFloat(String(aperture).replace(/[^0-9.]/g, ''))
    const fStop = isNaN(cleanAperture) ? 8.0 : cleanAperture
    const apMult = Math.pow(8.0 / fStop, 2)
    const shutterSec = parseShutter(shutter)
    const baseShutterSec = 1 / 125
    const shutterMult = shutterSec / baseShutterSec

    const exposureMultiplier = isoMult * apMult * shutterMult
    const clampedExposure = Math.max(0.1, Math.min(exposureMultiplier, 5.0))
    rendererRef.current.toneMappingExposure = 1.05 * clampedExposure

    // 2. Depth of Field (BokehPass)
    const dynamicBokeh = isNaN(cleanAperture) ? 0 : Math.max(0, (8.0 - cleanAperture) * 2.5)
    const safeBokeh = Math.min(dynamicBokeh, 4.5)
    if (bokehPassRef.current && bokehPassRef.current.uniforms) {
      if (bokehPassRef.current.uniforms['focus']) bokehPassRef.current.uniforms['focus'].value = focusDistance || 5.0
      // Hardcode aperture to a medium slice for plane separation (equivalent to focalLength=0.015)
      if (bokehPassRef.current.uniforms['aperture']) bokehPassRef.current.uniforms['aperture'].value = 0.015
      // Map blur strictly so F8+ yields 0, F1.8 yields heavy blur
      if (bokehPassRef.current.uniforms['maxblur']) bokehPassRef.current.uniforms['maxblur'].value = safeBokeh * 0.002
    }

    // 3. Image Noise (FilmPass)
    let noiseIntensity = 0
    if (iso > 400) {
      noiseIntensity = ((iso - 400) / 6000) * 1.5
    }
    if (filmPassRef.current && filmPassRef.current.uniforms && filmPassRef.current.uniforms['nIntensity']) {
      filmPassRef.current.uniforms['nIntensity'].value = noiseIntensity
    }
  }, [iso, shutter, aperture, focusDistance])

  // ── Focal length → FOV ────────────────────────────────────────────────────
  useEffect(() => {
    if (!cameraRef.current) return
    const fov = 2 * Math.atan(35 / (2 * focalLength)) * (180 / Math.PI)
    cameraRef.current.fov = Math.max(10, Math.min(120, Math.round(fov)))
    cameraRef.current.updateProjectionMatrix()
  }, [focalLength])

  // ── Pointer lock ──────────────────────────────────────────────────────────
  useEffect(() => {
    const onChange = () => {
      setIsPointerLocked(document.pointerLockElement === mountRef.current)
    }
    document.addEventListener('pointerlockchange', onChange)
    document.addEventListener('pointerlockerror', () => console.warn('PL failed'))
    return () => {
      document.removeEventListener('pointerlockchange', onChange)
    }
  }, [])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== mountRef.current) return
      yawRef.current -= e.movementX * 0.002
      pitchRef.current = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, pitchRef.current - e.movementY * 0.002))
    }
    document.addEventListener('mousemove', onMove)
    return () => document.removeEventListener('mousemove', onMove)
  }, [])

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keysRef.current.add(e.key.toLowerCase())
      if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(e.key.toLowerCase())) e.preventDefault()
    }
    const up = (e: KeyboardEvent) => keysRef.current.delete(e.key.toLowerCase())
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [])

  const requestPointerLock = () => { setHasEnteredOnce(true); mountRef.current?.requestPointerLock() }
  const exitPointerLock = () => { if (document.pointerLockElement) document.exitPointerLock() }
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen()
    else document.exitFullscreen()
  }

  // ── Synthetic shutter sound via Web Audio API ────────────────────────────
  const playShutter = () => {
    try {
      const ctx = new AudioContext()
      // Mechanical click body
      const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.08), ctx.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.015))
      }
      const src = ctx.createBufferSource()
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.4, ctx.currentTime)
      src.buffer = buf
      src.connect(gain)
      gain.connect(ctx.destination)
      src.start()
    } catch (_) { /* audio not supported */ }
  }

  // ── Scroll-to-zoom ───────────────────────────────────────────────────────
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 2 : -2
    const next = Math.min(200, Math.max(14, focalLength + delta))
    onFocalLengthChange?.(next)
  }

  // ── Right-click snapshot ─────────────────────────────────────────────────
  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button === 2) rightMouseDownRef.current = true
  }
  const onMouseUp = (e: React.MouseEvent) => {
    if (e.button !== 2 || !rightMouseDownRef.current) return
    rightMouseDownRef.current = false
    const renderer = rendererRef.current
    const composer = composerRef.current
    if (!renderer || !composer) return
    // Capture frame safely
    requestAnimationFrame(() => {
      const reticleVisible = afReticleRef.current ? afReticleRef.current.visible : false
      if (afReticleRef.current) afReticleRef.current.visible = false
      
      composer.render()
      const dataUrl = renderer.domElement.toDataURL('image/png')
      
      if (afReticleRef.current) afReticleRef.current.visible = reticleVisible
      
      const now = new Date()
      const ts = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`
      // Flash
      setFlashActive(true)
      setTimeout(() => setFlashActive(false), 350)
      // Sound
      playShutter()
      // Send to gallery
      onSnapshot?.(dataUrl, ts)
    })
  }
  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
  }

  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!cameraRef.current || !mountRef.current) return

    let rayPointer = centerVec2.current
    if (!isPointerLocked) {
      if (popup) return
      const rect = mountRef.current.getBoundingClientRect()
      rayPointer = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
      requestPointerLock()
    }

    raycasterRef.current.setFromCamera(rayPointer, cameraRef.current)

    const iMeshes = [...interactMeshesRef.current.values()]
    const lHits = raycasterRef.current.intersectObjects(iMeshes)
    if (lHits.length > 0 && lHits[0].distance < 10) {
      const hitName = lHits[0].object.name
      exitPointerLock()
      const worldPos = lHits[0].object.position.clone()
      const rect = mountRef.current.getBoundingClientRect()
      const proj = worldPos.project(cameraRef.current)
      const sx = Math.round((proj.x * 0.5 + 0.5) * rect.width)
      const sy = Math.round((-proj.y * 0.5 + 0.5) * rect.height)
      setPopup({ lightId: hitName, screenX: sx, screenY: sy })
      return
    }

    const rHits = raycasterRef.current.intersectObjects(teleportRingsRef.current)
    if (rHits.length > 0) {
      const idx = teleportRingsRef.current.indexOf(rHits[0].object as THREE.Mesh)
      if (idx >= 0 && cameraRef.current) {
        const t = teleportPositions[idx]
        cameraRef.current.position.set(t.x, 1.65, t.z + 0.5)
      }
      return
    }

    // Touch AF fallback
    if (sceneRef.current && cameraRef.current) {
      const allHits = raycasterRef.current.intersectObjects(sceneRef.current.children, true)
      const validHits = allHits.filter(h => h.object !== afReticleRef.current)
      if (validHits.length > 0) {
        const hit = validHits[0]
        
        // Exact flat plane distance (prevents edge blur)
        const cameraForward = new THREE.Vector3(0, 0, -1).applyQuaternion(cameraRef.current.quaternion)
        const pointVector = hit.point.clone().sub(cameraRef.current.position)
        const dist = pointVector.dot(cameraForward)
        
        setFocusDistance(Math.max(0.1, dist))

        if (afReticleRef.current) {
          afReticleRef.current.position.copy(hit.point)
          const dir = cameraRef.current.position.clone().sub(hit.point).normalize()
          afReticleRef.current.position.addScaledVector(dir, 0.05)
          afReticleRef.current.lookAt(cameraRef.current.position)
          afReticleRef.current.visible = true

          if (afTimeoutRef.current) clearTimeout(afTimeoutRef.current)
          afTimeoutRef.current = setTimeout(() => {
            if (afReticleRef.current) afReticleRef.current.visible = false
          }, 800)
        }
      }
    }
  }

  const activeLight = popup ? lights.find(l => l.id === popup.lightId) : null

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-[#d6d6d6]">
      {/* Canvas */}
      <div
        ref={mountRef}
        className="w-full h-full"
        onClick={onClick}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onContextMenu={onContextMenu}
        style={{ cursor: isPointerLocked ? 'none' : 'crosshair' }}
      />

      {/* White flash overlay on snapshot */}
      {flashActive && (
        <div className="absolute inset-0 bg-white z-50 animate-flash pointer-events-none" />
      )}

      {/* First-entry invite overlay */}
      {!isPointerLocked && !hasEnteredOnce && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/25 backdrop-blur-[2px]">
          <button
            onClick={e => { e.stopPropagation(); requestPointerLock() }}
            className="flex flex-col items-center gap-3 bg-white/80 backdrop-blur-md border border-white/60 rounded-2xl px-10 py-8 shadow-2xl hover:bg-white/90 transition-all group"
          >
            <MousePointerClick size={34} className="text-red-500 group-hover:scale-110 transition-transform" />
            <p className="text-gray-900 font-bold text-base">Click để vào Studio</p>
            <p className="text-gray-500 text-xs">Di chuyển bằng [W][A][S][D] · Click đèn để chỉnh ánh sáng</p>
          </button>
        </div>
      )}

      {/* Re-enter hint when unlocked after first entry */}
      {!isPointerLocked && hasEnteredOnce && !popup && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/30 border border-white/20 text-white/70 text-xs backdrop-blur-sm">
            <MousePointerClick size={12} /> Click để điều hướng
          </div>
        </div>
      )}

      {/* Active indicator pill */}
      {isPointerLocked && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/30 border border-white/20 backdrop-blur-sm pointer-events-none">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-white/80 text-xs font-semibold tracking-wide">STUDIO ACTIVE</span>
        </div>
      )}

      {/* Top-right toolbar */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
        {isPointerLocked && (
          <button onClick={e => { e.stopPropagation(); exitPointerLock() }}
            className="px-3 py-1.5 rounded-full bg-black/30 border border-white/20 backdrop-blur-md text-white/70 text-xs hover:text-white hover:bg-black/50 transition">
            Release
          </button>
        )}
        <button onClick={e => { e.stopPropagation(); toggleFullscreen() }}
          className="p-2 rounded-full bg-black/30 border border-white/20 backdrop-blur-md text-white/70 hover:text-white hover:bg-black/50 transition"
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
          {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
        </button>
      </div>

      {/* In-world light popup */}
      {popup && activeLight && (
        <div
          className="absolute z-30 w-60 bg-white/95 border border-gray-200 rounded-2xl shadow-2xl backdrop-blur-md p-4 overflow-hidden"
          style={{
            left: Math.min(Math.max(popup.screenX - 120, 8), (mountRef.current?.clientWidth ?? 600) - 248),
            top: Math.max(popup.screenY - 200, 8),
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: activeLight.color }} />
              <span className="text-gray-800 text-xs font-bold uppercase tracking-wider truncate max-w-[140px]">{activeLight.label}</span>
            </div>
            <button onClick={() => setPopup(null)} className="text-gray-400 hover:text-gray-700 text-base leading-none">✕</button>
          </div>

          {/* Brightness */}
          <label className="block text-gray-500 text-xs mb-1 font-medium">Intensity</label>
          <div className="flex items-center gap-2 mb-3">
            <input type="range" min="0" max="1" step="0.02"
              value={activeLight.brightness}
              onChange={e => onLightsChange(lights.map(l => l.id === popup.lightId ? { ...l, brightness: parseFloat(e.target.value) } : l))}
              className="flex-1 accent-red-500 cursor-pointer"
            />
            <span className="text-xs font-mono text-gray-600 w-8 text-right">{Math.round(activeLight.brightness * 100)}%</span>
          </div>

          {/* Color */}
          <label className="block text-gray-500 text-xs mb-1 font-medium">Color</label>
          <div className="flex items-center gap-3 mb-3">
            <input type="color" value={activeLight.color}
              onChange={e => onLightsChange(lights.map(l => l.id === popup.lightId ? { ...l, color: e.target.value } : l))}
              className="w-10 h-10 rounded-lg cursor-pointer border-2 border-gray-200 bg-transparent p-0.5"
            />
            <div className="flex gap-1.5 flex-wrap">
              {['#ffffff', '#ffffcc', '#ffddaa', '#aaddff', '#ffaacc', '#aaffcc'].map(c => (
                <button key={c} onClick={() => onLightsChange(lights.map(l => l.id === popup.lightId ? { ...l, color: c } : l))}
                  className="w-6 h-6 rounded-full border-2 transition hover:scale-110"
                  style={{ backgroundColor: c, borderColor: activeLight.color === c ? '#e63946' : '#e5e7eb' }}
                />
              ))}
            </div>
          </div>

          {/* On/Off toggle */}
          <button
            onClick={() => onLightsChange(lights.map(l => l.id === popup.lightId ? { ...l, brightness: l.brightness > 0 ? 0 : 0.7 } : l))}
            className={`w-full py-2 rounded-xl text-xs font-semibold transition ${activeLight.brightness > 0 ? 'bg-gray-100 text-gray-700 hover:bg-red-50 hover:text-red-600' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
          >
            {activeLight.brightness > 0 ? '🔆 Turn Off' : '🔅 Turn On'}
          </button>

          <button onClick={() => { setPopup(null); requestPointerLock() }}
            className="mt-2 w-full py-1.5 rounded-xl bg-gray-900 text-white text-xs font-semibold hover:bg-gray-700 transition">
            Done — Re-enter Studio
          </button>
        </div>
      )}

      {/* HUD */}
      {isPointerLocked && (
        <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between pointer-events-none">
          <div className="px-3 py-1.5 rounded-lg bg-black/30 border border-white/20 text-white/60 text-xs backdrop-blur-sm">
            [W][A][S][D] walk · Click lamp to adjust · Click ring to teleport
          </div>
          <div className="px-3 py-1.5 rounded-full bg-black/30 border border-white/20 text-white/80 text-xs font-mono backdrop-blur-sm">
            {fps} FPS · {focalLength}mm
          </div>
        </div>
      )}

      {/* Crosshair */}
      {isPointerLocked && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative flex items-center justify-center">
            {/* Hover ring */}
            <div className={`absolute rounded-full border-2 transition-all duration-150 ${
              hoveredInteractable === 'light' ? 'w-11 h-11 border-yellow-400/80 scale-100' :
              hoveredInteractable === 'ring'  ? 'w-11 h-11 border-red-400/80 scale-100' : 'w-4 h-4 border-transparent scale-0'
            }`} />
            {/* Lines */}
            <div className={`w-5 h-5 relative transition-all duration-100 ${hoveredInteractable ? 'scale-75 opacity-70' : 'scale-100 opacity-100'}`}>
              <div className={`absolute top-1/2 left-0 w-full h-px ${hoveredInteractable === 'light' ? 'bg-yellow-400' : hoveredInteractable === 'ring' ? 'bg-red-400' : 'bg-white/70'}`} />
              <div className={`absolute left-1/2 top-0 h-full w-px ${hoveredInteractable === 'light' ? 'bg-yellow-400' : hoveredInteractable === 'ring' ? 'bg-red-400' : 'bg-white/70'}`} />
              <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full ${hoveredInteractable === 'light' ? 'bg-yellow-400' : hoveredInteractable === 'ring' ? 'bg-red-400' : 'bg-white'}`} />
            </div>
            {/* Tooltip */}
            {hoveredInteractable && (
              <div className={`absolute top-7 left-1/2 -translate-x-1/2 whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-semibold backdrop-blur-sm border ${
                hoveredInteractable === 'light' ? 'bg-yellow-500/20 border-yellow-400/40 text-yellow-200' : 'bg-red-500/20 border-red-400/40 text-red-200'
              }`}>
                {hoveredInteractable === 'light' ? '💡 Click to adjust light' : '⬤ Click to teleport'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
