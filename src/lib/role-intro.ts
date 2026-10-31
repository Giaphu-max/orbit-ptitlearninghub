// Intro sau khi chọn / đổi vai trò (theo docs/mockup/intro/ptit-intro-splash.html, dựng bằng Canvas 2D + WebGL).
// MỘT dòng chuyển động liền: sân khấu (nền trắng, mảng đỏ loang, quỹ đạo) lan từ thẻ vừa bấm → logo gốc của trường (vòng, P-T-I-T, sao, sách)
// → dòng chữ Học viện → màn "tan" như màng nước trên kính, lộ trang thật. Đổi vai + chuyển trang diễn ra khi sân khấu vừa phủ kín.
// Cảnh vẫn được vẽ lại mỗi khung (và upload lên texture) suốt bước tan. Một vòng rAF riêng, dừng khi intro đóng.
// Bấm / Enter / Esc tua nhanh tới bước tan trong 250ms.

import { INTRO_PARTS, META, type IntroPart } from '@/lib/intro-meta'
import { loadCampusStill } from '@/lib/campus-still'

export interface IntroInfo {
    /** Các từ của lời chào; ghép lại thành dòng mono ở đáy màn */
    words: { text: string; name?: boolean }[]
    /** Các trường chip/pre/strong/post không còn hiển thị, giữ trong type cho nơi gọi */
    chip: string
    pre: string
    strong: string
    post: string
    loadText: string
}

export interface IntroHooks {
    /** Đổi vai + chuyển trang; gọi khi màn intro còn che kín. */
    swap: () => void
}

let root: HTMLElement | null = null
let active = false
let abort: (() => void) | null = null

let unbindResize: (() => void) | null = null

export const bindIntro = (r: HTMLElement | null) => {
    if (!r) abort?.()
    unbindResize?.()
    unbindResize = null
    root = r
    if (r) {
        // Chuẩn bị sẵn lúc rảnh: ảnh, font, các canvas, WebGL; chuẩn bị lại sau resize (debounce 200ms)
        warmUp()
        let t = 0
        const onResize = () => {
            if (active) return
            clearTimeout(t)
            t = window.setTimeout(() => !active && prepare(), 200)
        }
        window.addEventListener('resize', onResize)
        unbindResize = () => {
            clearTimeout(t)
            window.removeEventListener('resize', onResize)
        }
    }
}
export const introReady = () => root !== null
/** Intro đang chạy: không chạy chồng hai lần, không cho đổi giao diện chen vào. */
export const introPlaying = () => active

const doneWaiters: (() => void)[] = []
/** Resolve khi intro đóng (ngay lập tức nếu không có intro đang chạy). Sự kiện tương ứng: window 'orbit:intro-done'. */
export const introDone = (): Promise<void> => (active ? new Promise<void>((res) => doneWaiters.push(res)) : Promise.resolve())

/* ---------- công cụ đo ?introdebug ---------- */
const DEBUG = typeof location !== 'undefined' && new URLSearchParams(location.search).has('introdebug')
const dbg = { frames: [] as { vt: number; phase: string; gap: number; js: number }[], marks: [] as { vt: number; name: string }[], t0: 0 }
if (DEBUG) (window as unknown as { __introDebug: typeof dbg }).__introDebug = dbg
/** Ghi một mốc vào bảng đo (chỉ khi có ?introdebug); gọi được từ nơi khác (vd. lúc mount cảnh 3D) */
export function introMark(name: string) {
    if (!DEBUG) return
    const at = performance.now()
    console.info(`[introdebug] ${name} @${Math.round(at)}ms`)
    if (active) dbg.marks.push({ vt: +((at - dbg.t0) / 1000).toFixed(3), name })
}

/* ---------- hằng số ---------- */
// Mốc thời gian (giây) tính từ lúc bấm; các bước gối lên nhau, không có khoảng trống.
const T = { spread: 0.7, swap: 0.72, orbit: [0.25, 0.38, 0.5], ring: [0.45, 1.65], letters: 1.15, star: 1.65, book: 1.8, word: 2.0, sub: 2.3, greet: 2.55, sheen: [2.65, 3.35], tan: 3.2, water: 2.6 }
const LANDED_AT = 1.2
const SKIP_MS = 250
/** Tối đa kéo dài pha cảnh sau mốc tan để chờ trang đích (giây) */
const PAGE_WAIT = 1.0
/** Quỹ đạo: hạt đi hết một vòng vẽ ở τ = 1,3s, vận tốc giảm mượt về ω chứ không về 0 */
const ORB_K = 2.5
const ORB_W = 0.9
const ORB_A = (Math.PI * 2 - ORB_W * 1.3) / (1 - Math.exp(-ORB_K * 1.3))
/** Camera đẩy vào liên tục: 1,075 → 1,0 (đến lúc tan) rồi 1,0 → 0,985 hết lúc tan; vận tốc liền ở chỗ nối */
const G0 = 1.075
const G1 = 1.0
const G2 = 0.985

const SANS = '"Be Vietnam Pro", system-ui, sans-serif'
const MONO = '"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, monospace'

const cl = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x))
const prog = (t: number, a: number, d: number) => cl((t - a) / d)
const eoc = (x: number) => 1 - Math.pow(1 - x, 3)
const eox = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x))
const eio = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
const back = (x: number) => {
    const c1 = 1.9
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}

/* ---------- ảnh các mảnh logo ---------- */
type Layers = Record<IntroPart, HTMLImageElement>
let imagesP: Promise<Layers> | null = null
function preloadImages(): Promise<Layers> {
    imagesP ??= Promise.all(
        INTRO_PARTS.map(
            (n) =>
                new Promise<HTMLImageElement>((res, rej) => {
                    const i = new Image()
                    i.onload = () => res(i)
                    i.onerror = () => rej(new Error(`intro: không tải được L-${n}.webp`))
                    i.src = `/brand/intro/L-${n}.webp`
                }),
        ),
    ).then((imgs) => Object.fromEntries(INTRO_PARTS.map((n, i) => [n, imgs[i]])) as Layers)
    imagesP.then((l) => (layersOk = l)).catch(() => (imagesP = null))
    return imagesP
}

/* ---------- shader tan (màng nước trên kính) ---------- */
const VS = `attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0,1);}`
const FS = `#extension GL_OES_standard_derivatives : enable
precision highp float;varying vec2 v;uniform sampler2D S;uniform vec2 R;uniform float t;uniform vec2 I;
float h1(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float ns(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(h1(i),h1(i+vec2(1,0)),u.x),mix(h1(i+vec2(0,1)),h1(i+vec2(1,1)),u.x),u.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*ns(p);p=p*2.03+17.1;a*=.5;}return s;}
vec3 vor(vec2 p){vec2 i=floor(p),f=fract(p);float d1=8.,d2=8.,id=0.;
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(x,y);vec2 o=.12+.76*vec2(h1(i+g),h1(i+g+19.19));vec2 r=g+o-f;float d=dot(r,r);
    if(d<d1){d2=d1;d1=d;id=h1(i+g+3.7);}else if(d<d2){d2=d;}}
  return vec3(sqrt(d1),sqrt(d2),id);}
float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
float smax(float a,float b,float k){return -smin(-a,-b,k);}
float ease(float x){x=clamp(x,0.,1.);return x*x*(3.-2.*x);}
float eoc(float x){x=clamp(x,0.,1.);return 1.-pow(1.-x,3.);}
void main(){
  vec2 uv=v; vec2 q=uv*vec2(R.x/R.y,1.);
  /* slow liquid wobble: the web keeps flowing while it drains */
  vec2 qw=q+.30*(vec2(fbm(q*1.6+vec2(0.,t*.22)),fbm(q*1.6+7.3-vec2(t*.18,0.)))-.5);
  const float SC=3.3;
  vec3 V=vor(qw*SC);
  float e=V.y-V.x;
  float st=.0+V.z*.85+(1.-uv.y)*.30;
  float g=ease((t-st)/1.25);
  float thin=ease((t-1.35)/1.0);
  float W=.085*(1.-thin*(.9+.25*ns(qw*6.+t*.3)));      // web thins softly, then pinches into beads
  float Rg=1.1*g;
  float d=smax(V.x-Rg,W-e,.16);
  /* small round bubbles inside the web */
  const float SS=11.;
  vec3 Vs=vor(qw*SS+4.1);
  float sst=.45+Vs.z*1.1+(1.-uv.y)*.25;
  float rs=.36*ease((t-sst)/.9)*step(.25,Vs.z);
  float ds=(Vs.x-rs)*SC/SS+(1.-smoothstep(.0,.06,rs))*.5;                           // same units as d
  float D=smin(d,ds,.04);                            // film = outside both kinds of hole, joined softly
  float px=2.*SC/R.y;
  float m=smoothstep(-px*1.6,px*1.6,D);
  /* meniscus: film is thicker inside, curves down to zero at every hole edge */
  float th=sqrt(clamp(D/.11,0.,1.));
  vec2 gr=vec2(dFdx(th),dFdy(th))*7.;
  vec3 N=normalize(vec3(-gr,1.));
  vec2 off=-N.xy*3./R;                                // a few pixels of lens at the curved edge
  vec3 col=texture2D(S,uv+off*m).rgb;
  vec3 L=normalize(vec3(-.5,.6,.65));
  float diff=dot(N,L)-L.z;                            // 0 on flat film
  float spec=pow(max(dot(N,normalize(L+vec3(0,0,1))),0.),6.)*(1.-th)*step(.001,length(gr));
  col*=1.+diff*.10;
  col=mix(col,vec3(1.),spec*.28);
  float fade=1.-ease((t-1.95)/.6);
  m*=fade;
  gl_FragColor=vec4(col*m,m);
}`

/* ---------- WebGL dựng sẵn (compile shader trước khi cần) ---------- */
interface GPU {
    canvas: HTMLCanvasElement
    gl: WebGLRenderingContext
    tex: WebGLTexture
    uni: Record<'S' | 'R' | 't' | 'I', WebGLUniformLocation | null>
    /** Kích thước texture hiện tại (để biết khi nào phải cấp phát lại) */
    texW: number
    texH: number
}
let gpu: GPU | null = null

function initGPU(glc: HTMLCanvasElement): GPU | null {
    let gl: WebGLRenderingContext | null = null
    try {
        gl = glc.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false })
    } catch {
        gl = null
    }
    if (!gl || !gl.getExtension('OES_standard_derivatives')) return null
    const sh = (ty: number, src: string) => {
        const s = gl.createShader(ty)
        if (!s) return null
        gl.shaderSource(s, src)
        gl.compileShader(s)
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
            console.warn(gl.getShaderInfoLog(s))
            return null
        }
        return s
    }
    const vs = sh(gl.VERTEX_SHADER, VS)
    const fs = sh(gl.FRAGMENT_SHADER, FS)
    const prg = gl.createProgram()
    if (!vs || !fs || !prg) return null
    gl.attachShader(prg, vs)
    gl.attachShader(prg, fs)
    gl.linkProgram(prg)
    if (!gl.getProgramParameter(prg, gl.LINK_STATUS)) return null
    gl.useProgram(prg)
    const b = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, b)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prg, 'p')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    const uni = { S: gl.getUniformLocation(prg, 'S'), R: gl.getUniformLocation(prg, 'R'), t: gl.getUniformLocation(prg, 't'), I: gl.getUniformLocation(prg, 'I') }
    const tex = gl.createTexture()
    if (!tex) return null
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    ;[gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach((p) => gl.texParameteri(gl.TEXTURE_2D, p, gl.CLAMP_TO_EDGE))
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    // Vẽ thử một khung 1×1 để driver compile xong shader
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4))
    gl.viewport(0, 0, 1, 1)
    gl.uniform1i(uni.S, 0)
    gl.uniform2f(uni.R, 1, 1)
    gl.uniform1f(uni.t, 0)
    gl.uniform2f(uni.I, 0.5, 0.5)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    const g: GPU = { canvas: glc, gl, tex, uni, texW: 1, texH: 1 }
    P.key = ''
    // Mất context: bỏ bản cũ, thay canvas bằng bản mới; lần chạy sau tạo lại
    glc.addEventListener('webglcontextlost', (e) => {
        e.preventDefault()
        if (gpu === g) gpu = null
        if (!active && glc.isConnected) {
            const fresh = glc.cloneNode(false) as HTMLCanvasElement
            fresh.removeAttribute('width')
            fresh.removeAttribute('height')
            glc.replaceWith(fresh)
        }
    })
    return g
}

function ensureGPU(): GPU | null {
    const glc = root?.querySelector<HTMLCanvasElement>('[data-ri="gl"]')
    if (!glc) return null
    if (gpu && gpu.canvas === glc && !gpu.gl.isContextLost()) return gpu
    gpu = initGPU(glc)
    return gpu
}

/** Khởi tạo sớm lúc rảnh để lần bấm đầu tiên không phải compile shader */
function warmUp() {
    const run = () => {
        // Tải sẵn code các trang có thể là đích sau khi chọn vai (chunk đã nằm trong cache lúc đổi trang) + ảnh tĩnh khuôn viên
        for (const load of [
            () => import('@/components/orbit-home-view'),
            () => import('@/components/teacher/teacher-overview'),
            () => import('@/components/home/tower-scene'),
        ])
            void load().catch(() => undefined)
        void loadCampusStill()
        void Promise.all([preloadImages(), preloadFonts()]).then(() => {
            if (!root || active) return
            try {
                prepare()
            } catch {
                gpu = null
            }
        })
    }
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback
    if (ric) ric(run)
    else window.setTimeout(run, 300)
}

const IMPACT = [0.36, 0.62]

/* ---------- chuẩn bị sẵn (ảnh, font, canvas, texture) ---------- */
let fontsP: Promise<void> | null = null
let fontsOk = false
let layersOk: Layers | null = null
function preloadFonts() {
    fontsP ??= Promise.all([document.fonts.load('800 24px "Be Vietnam Pro"'), document.fonts.load('500 14px "Be Vietnam Pro"'), document.fonts.load('700 12px "JetBrains Mono Variable"')])
        .catch(() => undefined)
        .then(() => {
            fontsOk = true
        })
    return fontsP
}

/** Kích thước và các canvas phụ dùng chung giữa các lần chạy */
const P = { W: 0, H: 0, DPR: 1, key: '', bg: document.createElement('canvas'), lay: document.createElement('canvas') }

/** Nền trắng + 5 mảng đỏ loang + quầng trắng giữa: vẽ một lần ở 0,5× độ phân giải, dư 3% mỗi cạnh cho phần trôi */
function buildBg() {
    const { W, H, bg } = P
    const bgc = bg.getContext('2d')
    if (!bgc) return
    const M = Math.max(W, H)
    bg.width = Math.max(1, Math.round(W * 1.06 * 0.5))
    bg.height = Math.max(1, Math.round(H * 1.06 * 0.5))
    bgc.setTransform(0.5, 0, 0, 0.5, W * 0.03 * 0.5, H * 0.03 * 0.5)
    bgc.fillStyle = '#FFFFFF'
    bgc.fillRect(-W, -H, W * 3, H * 3)
    const blob = (x: number, y: number, r: number, col: string, a: number) => {
        const gr = bgc.createRadialGradient(x, y, 0, x, y, r)
        gr.addColorStop(0, 'rgba(' + col + ',' + a + ')')
        gr.addColorStop(0.55, 'rgba(' + col + ',' + a * 0.35 + ')')
        gr.addColorStop(1, 'rgba(' + col + ',0)')
        bgc.fillStyle = gr
        bgc.fillRect(-W, -H, W * 3, H * 3)
    }
    blob(W * 1.02, H * -0.05, M * 0.55, '226,38,28', 0.3)
    blob(W * 0.86, H * 0.1, M * 0.26, '255,90,71', 0.18)
    blob(W * -0.04, H * 1.06, M * 0.5, '200,27,18', 0.26)
    blob(W * 0.14, H * 0.96, M * 0.22, '244,135,143', 0.2)
    blob(W * 1.0, H * 1.02, M * 0.24, '226,38,28', 0.1)
    blob(W / 2, H * 0.42, Math.min(W, H) * 0.42, '255,255,255', 0.9)
}

/** Vẽ một khung shader ở viewport thật (t = -1: chưa có lỗ nào) để driver chạy xong lần đầu */
function warmDraw(g: GPU) {
    const { gl, uni, canvas } = g
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.uniform1i(uni.S, 0)
    gl.uniform2f(uni.R, canvas.width, canvas.height)
    gl.uniform1f(uni.t, -1)
    gl.uniform2f(uni.I, 0.5, 0.5)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
}

/**
 * Cấp phát sẵn mọi thứ theo viewport hiện tại: canvas scene, nền, lớp logo, canvas GL + texture (texImage2D null) và vẽ thử shader.
 * Chỉ làm lại khi viewport đổi (hoặc force). Trả false nếu chưa có phần tử.
 */
function prepare(force = false): boolean {
    const sc = root?.querySelector<HTMLCanvasElement>('[data-ri="scene"]')
    if (!sc) return false
    const DPR = Math.min(2, window.devicePixelRatio || 1)
    const W = window.innerWidth
    const H = window.innerHeight
    const key = `${W}x${H}x${DPR}`
    const reducedMq = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const g = reducedMq ? null : ensureGPU()
    if (!force && key === P.key && (!g || g.texW === sc.width)) return true
    P.W = W
    P.H = H
    P.DPR = DPR
    sc.width = Math.round(W * DPR)
    sc.height = Math.round(H * DPR)
    buildBg()
    // Lớp logo cấp phát một lần ở độ phóng lớn nhất; khung nào cũng chỉ vẽ lại vào đó
    const LH = Math.min(H * 0.4, 380)
    P.lay.width = Math.ceil(600 * (LH / 763) * DPR * G0)
    P.lay.height = Math.ceil(763 * (LH / 763) * DPR * G0)
    if (g) {
        const gd = Math.min(DPR, 2, 2880 / W)
        g.canvas.width = Math.round(W * gd)
        g.canvas.height = Math.round(H * gd)
        const { gl, tex } = g
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, tex)
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, sc.width, sc.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
        g.texW = sc.width
        g.texH = sc.height
        warmDraw(g)
    }
    // Vẽ thử các dòng chữ ở đúng cỡ để trình duyệt dựng glyph trước (khung đầu tiên có chữ không bị chậm)
    if (fontsOk) {
        const wc = document.createElement('canvas').getContext('2d')
        if (wc) {
            const fs = Math.round(cl(W * 0.0165, 18, 30))
            wc.font = '800 ' + fs + 'px ' + SANS
            wc.fillText('HỌC VIỆN CÔNG NGHỆ BƯU CHÍNH VIỄN THÔNG', 0, 20)
            wc.font = '500 ' + Math.round(fs * 0.56) + 'px ' + SANS
            wc.fillText('Posts and Telecommunications Institute of Technology', 0, 20)
            wc.font = '700 12.5px ' + MONO
            wc.fillText('CHÀO · ĐANG MỞ LỚP HỌC CỦA BẠN', 0, 20)
        }
    }
    P.key = key
    return true
}

/** cubic-bezier(x1,y1,x2,y2) như CSS */
function bezier(x1: number, y1: number, x2: number, y2: number) {
    const ax = 3 * x1 - 3 * x2 + 1
    const bx = 3 * x2 - 6 * x1
    const cx = 3 * x1
    const ay = 3 * y1 - 3 * y2 + 1
    const by = 3 * y2 - 6 * y1
    const cy = 3 * y1
    return (x: number) => {
        let lo = 0
        let hi = 1
        let u = x
        for (let i = 0; i < 20; i++) {
            const bxu = ((ax * u + bx) * u + cx) * u
            if (bxu < x) lo = u
            else hi = u
            u = (lo + hi) / 2
        }
        return ((ay * u + by) * u + cy) * u
    }
}
const spreadEase = bezier(0.65, 0, 0.35, 1)

/** Độ phóng của camera tại thời điểm t: một đường cong liền, vận tốc khớp ở mốc tan */
function camera(t: number) {
    const D1 = T.tan - T.ring[0]
    const D2 = T.tan + T.water - T.tan
    const d1 = G0 - G1
    const d2 = G1 - G2
    const c = (d2 / D2) * (D1 / d1) // hệ số để vận tốc cuối đoạn 1 = vận tốc đoạn 2
    if (t <= T.ring[0]) return G0
    if (t < T.tan) {
        const u = (t - T.ring[0]) / D1
        return G0 - d1 * (c * u + (1 - c) * (2 * u - u * u))
    }
    // Không chặn ở G2: nếu phải chờ trang đích, camera vẫn tiếp tục đẩy vào cùng vận tốc
    return G1 - d2 * ((t - T.tan) / D2)
}

/* ---------- phát intro ---------- */
export function playRoleIntro(origin: { x: number; y: number }, info: IntroInfo, hooks: IntroHooks): Promise<void> {
    const el = root
    if (!el || active) {
        hooks.swap()
        return Promise.resolve()
    }
    const sc = el.querySelector<HTMLCanvasElement>('[data-ri="scene"]')
    const ctx = sc?.getContext('2d')
    if (!sc || !ctx) {
        hooks.swap()
        return Promise.resolve()
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const greeting = `${info.words.map((w) => w.text).join(' ').replace(/,\s*$/, '')} · ${info.loadText}`.toUpperCase()

    let W = 0
    let H = 0
    let DPR = 1
    let Rmax = 0
    let swapped = false
    let finished = false
    let raf = 0
    let timer = 0
    let phase: 'scene' | 'water' | 'fade' | 'hold' = 'scene'
    let vt = 0
    let last = 0
    let skipRate = 0
    let g: GPU | null = null
    let L: Layers | null = null
    let resolve!: () => void
    const done = new Promise<void>((res) => (resolve = res))
    const lay = P.lay
    const lctx = lay.getContext('2d')
    const bg = P.bg
    let landedSent = false
    let fadeStart = 0
    let uploaded = false
    let waited = false
    // Chờ trang đích sẵn sàng (orbit:page-ready) trước khi tan: kéo dài pha cảnh tối đa PAGE_WAIT giây
    let expectPage = false
    let pageReady = false
    let tanAt = -1
    const onPageReady = () => {
        if (pageReady) return
        pageReady = true
        introMark('page-ready')
    }

    const swap = () => {
        if (swapped) return
        swapped = true
        introMark('swap')
        // Chỉ chờ khi trang đích sẽ được dựng mới (trang chủ chưa có trên màn); đã ở trang chủ rồi thì không có tín hiệu để chờ
        expectPage = !document.getElementById('home-stage')
        try {
            hooks.swap()
        } catch (e) {
            console.error(e)
        }
    }

    /** Lấy kích thước/canvas đã chuẩn bị (chỉ cấp phát lại nếu viewport đổi) */
    const resize = (force = false) => {
        prepare(force)
        DPR = P.DPR
        W = P.W
        H = P.H
        Rmax = Math.hypot(Math.max(origin.x, W - origin.x), Math.max(origin.y, H - origin.y)) + 20
    }

    /* ----- vẽ cảnh (Canvas 2D) ----- */
    function orbits(c: CanvasRenderingContext2D, t: number, cx: number, cy: number) {
        const base = Math.min(W, H)
        const defs = [
            [0.62, 0.3, 0.26, T.orbit[0]],
            [0.82, 0.36, 0.16, T.orbit[1]],
            [1.06, 0.42, 0.1, T.orbit[2]],
        ]
        defs.forEach(([rx, ry, a, del], i) => {
            const tau = t - del
            if (tau < 0) return
            // Góc hạt là MỘT hàm liên tục (không bao giờ dừng): θ(τ) = −π/2 + dir·(A(1 − e^(−kτ)) + ω·τ), vẽ xong đúng một vòng ở τ = 1,3
            const dir = i === 1 ? -1 : 1
            const swept = ORB_A * (1 - Math.exp(-ORB_K * tau)) + ORB_W * tau
            const th = -Math.PI / 2 + dir * swept
            const frac = cl(swept / (Math.PI * 2))
            const rot = ((-24 + i * 7) * Math.PI) / 180 + t * 0.03 * (i % 2 ? -1 : 1)
            c.save()
            c.translate(cx, cy)
            c.rotate(rot)
            c.strokeStyle = 'rgba(212,31,22,' + a + ')'
            c.lineWidth = i === 0 ? 1.6 : 1.2
            if (i === 1) c.setLineDash([2, 7])
            const ex = base * rx
            const ey = ((base * rx * ry) / 0.62) * 0.62
            c.beginPath()
            if (frac >= 1) c.ellipse(0, 0, ex, ey, 0, 0, Math.PI * 2)
            else c.ellipse(0, 0, ex, ey, 0, -Math.PI / 2, th, dir < 0)
            c.stroke()
            // hạt bám đầu nét ngay từ lúc bắt đầu vẽ
            const x = Math.cos(th) * ex
            const y = Math.sin(th) * ey
            c.setLineDash([])
            c.fillStyle = 'rgba(226,38,28,' + (i === 0 ? 0.95 : 0.55) + ')'
            c.beginPath()
            c.arc(x, y, i === 0 ? 4 : 2.6, 0, 7)
            c.fill()
            if (i === 0) {
                c.fillStyle = 'rgba(226,38,28,.18)'
                c.beginPath()
                c.arc(x, y, 10, 0, 7)
                c.fill()
            }
            c.restore()
        })
    }

    function part(c: CanvasRenderingContext2D, name: IntroPart, s: number, fn?: (x: number, y: number, w: number, h: number) => void) {
        const [x, y, w, h] = META[name]
        c.save()
        fn?.(x, y, w, h)
        c.drawImage(L![name], x * s, y * s, w * s, h * s)
        c.restore()
    }

    function drawLogo(c: CanvasRenderingContext2D, t: number, s: number) {
        c.setTransform(1, 0, 0, 1, 0, 0)
        c.clearRect(0, 0, lay.width, lay.height)
        const [ox, oy] = META.c
        // vòng: quét góc từ 118°, 372°
        const rp = eio(prog(t, T.ring[0], T.ring[1] - T.ring[0]))
        if (rp > 0) {
            const a0 = (118 * Math.PI) / 180
            const a1 = a0 + (rp * 372 * Math.PI) / 180
            c.save()
            c.beginPath()
            c.moveTo(ox * s, oy * s)
            c.arc(ox * s, oy * s, 900 * s, a0, a1)
            c.closePath()
            c.clip()
            part(c, 'ring', s)
            c.restore()
            // đốm sáng dẫn đầu
            if (rp < 1) {
                const deg = Math.round((a1 * 180) / Math.PI) % 360
                const r = META.radii[deg]
                if (r) {
                    const hx = (ox + Math.cos(a1) * r) * s
                    const hy = (oy + Math.sin(a1) * r) * s
                    const A = Math.sin(rp * Math.PI)
                    const gr = c.createRadialGradient(hx, hy, 0, hx, hy, 46 * s)
                    gr.addColorStop(0, 'rgba(255,255,255,' + 0.95 * A + ')')
                    gr.addColorStop(0.18, 'rgba(255,120,96,' + 0.85 * A + ')')
                    gr.addColorStop(1, 'rgba(226,38,28,0)')
                    c.fillStyle = gr
                    c.beginPath()
                    c.arc(hx, hy, 46 * s, 0, 7)
                    c.fill()
                }
            }
        }
        // chữ trồi lên trong khung của chính nó
        ;(['P', 'T1', 'I', 'T2'] as const).forEach((n, i) => {
            const p = prog(t, T.letters + i * 0.09, 0.7)
            if (p <= 0) return
            const e = eox(p)
            part(c, n, s, (x, y, w, h) => {
                c.beginPath()
                c.rect(x * s, (y - 2) * s, w * s, (h + 4) * s)
                c.clip()
                c.translate(0, (1 - e) * h * 1.05 * s)
            })
        })
        // sách mở từ giữa
        const bp = prog(t, T.book, 0.7)
        if (bp > 0) {
            const e = eox(bp)
            part(c, 'book', s, (_x, y, _w, h) => {
                c.beginPath()
                c.rect((300 - 300 * e) * s, y * s, 600 * e * s, h * s)
                c.clip()
            })
        }
        // sao bật + tia
        const sp = prog(t, T.star, 0.62)
        if (sp > 0) {
            const [x, y, w, h] = META.star
            const scx = (x + w * 0.58) * s
            const scy = (y + h * 0.5) * s
            const e = back(sp)
            const bt = prog(t, T.star + 0.12, 0.55)
            if (bt > 0 && bt < 1) {
                c.save()
                c.translate(scx, scy)
                c.strokeStyle = 'rgba(226,38,28,' + (1 - bt) + ')'
                c.lineCap = 'round'
                c.lineWidth = 3 * s
                for (let i = 0; i < 12; i++) {
                    const a = (i / 12) * Math.PI * 2 + 0.13
                    const r0 = (60 + eoc(bt) * 70) * s
                    const r1 = r0 + (26 * (1 - bt) + 6) * s
                    c.beginPath()
                    c.moveTo(Math.cos(a) * r0, Math.sin(a) * r0)
                    c.lineTo(Math.cos(a) * r1, Math.sin(a) * r1)
                    c.stroke()
                }
                c.restore()
            }
            c.save()
            c.translate(scx, scy)
            c.rotate((1 - eoc(sp)) * -2.1)
            c.scale(e, e)
            c.translate(-scx, -scy)
            c.drawImage(L!.star, x * s, y * s, w * s, h * s)
            c.restore()
        }
        // vệt sáng lướt logo
        const sh = prog(t, T.sheen[0], T.sheen[1] - T.sheen[0])
        if (sh > 0 && sh < 1) {
            c.save()
            c.globalCompositeOperation = 'source-atop'
            const pos = (-0.35 + eio(sh) * 1.7) * lay.width
            const gg = c.createLinearGradient(pos - 120 * s, 0, pos + 120 * s, lay.height * 0.35)
            gg.addColorStop(0, 'rgba(255,255,255,0)')
            gg.addColorStop(0.5, 'rgba(255,255,255,.62)')
            gg.addColorStop(1, 'rgba(255,255,255,0)')
            c.fillStyle = gg
            c.fillRect(0, 0, lay.width, lay.height)
            c.restore()
        }
    }

    /** Vẽ khung tại thời điểm t (giây từ lúc bấm). Sân khấu lan ra từ chỗ bấm trong 0,7s đầu. */
    function draw(t: number) {
        const c = ctx!
        c.setTransform(DPR, 0, 0, DPR, 0, 0)
        c.clearRect(0, 0, W, H)
        const p = spreadEase(cl(t / T.spread))
        if (p <= 0) return
        const cx = W / 2
        const cy = H * 0.42
        const clipped = p < 1
        if (clipped) {
            c.save()
            c.beginPath()
            c.arc(origin.x, origin.y, p * Rmax, 0, 7)
            c.clip()
        }
        // nền: ảnh dựng sẵn, chỉ dịch nhẹ để mảng đỏ trôi
        c.drawImage(bg, -W * 0.03 + Math.sin(t * 0.6) * W * 0.015, -H * 0.03 + Math.cos(t * 0.5) * H * 0.01, W * 1.06, H * 1.06)
        orbits(c, t, cx, cy)
        if (t >= T.ring[0] - 0.1) {
            const LH = Math.min(H * 0.4, 380)
            const gz = camera(t)
            drawLogo(lctx!, t, lay.width / 600)
            const dw = (lay.width / DPR) * (gz / G0)
            const dh = (lay.height / DPR) * (gz / G0)
            c.drawImage(lay, cx - dw / 2, cy - dh / 2, dw, dh)
            // dòng chữ Học viện
            const fs = Math.round(cl(W * 0.0165, 18, 30))
            const wy = cy + (LH * gz) / 2 + fs * 2.0
            const wp = prog(t, T.word, 0.9)
            const we = eox(wp)
            const setLS = (v: string) => {
                try {
                    c.letterSpacing = v
                } catch {
                    /* trình duyệt cũ không có letterSpacing */
                }
            }
            if (wp > 0) {
                c.save()
                c.textAlign = 'center'
                c.textBaseline = 'alphabetic'
                c.font = '800 ' + fs + 'px ' + SANS
                c.fillStyle = '#D41F16'
                setLS(Number((0.06 + 0.5 * (1 - we)).toFixed(3)) * fs + 'px')
                c.globalAlpha = cl(wp * 2.2)
                c.fillText('HỌC VIỆN CÔNG NGHỆ BƯU CHÍNH VIỄN THÔNG', cx, wy + (1 - we) * 10)
                const sp2 = prog(t, T.sub, 0.7)
                c.globalAlpha = eoc(sp2) * 0.9
                c.font = '500 ' + Math.round(fs * 0.56) + 'px ' + SANS
                c.fillStyle = '#7A5A56'
                setLS(0.04 * fs * 0.56 + 'px')
                c.fillText('Posts and Telecommunications Institute of Technology', cx, wy + fs * 1.25 + (1 - eoc(sp2)) * 8)
                // gạch đỏ mảnh dài dần
                const dl = eoc(prog(t, T.sub, 0.8)) * fs * 3.2
                c.globalAlpha = 0.55
                c.fillStyle = '#E2261C'
                c.fillRect(cx - dl, wy - fs * 1.25, dl * 2, 1.5)
                c.restore()
            }
            // dòng mono + thanh tải ở đáy
            const gp = prog(t, T.greet, 0.6)
            if (gp > 0) {
                c.save()
                c.globalAlpha = eoc(gp)
                c.textAlign = 'center'
                c.font = '700 12.5px ' + MONO
                c.fillStyle = '#8B5E58'
                setLS('2.5px')
                c.fillText(greeting, cx, H - 70)
                const bw = 150
                const bp = eio(prog(t, T.greet, T.tan - T.greet))
                c.fillStyle = 'rgba(226,38,28,.15)'
                c.fillRect(cx - bw / 2, H - 54, bw, 2)
                c.fillStyle = '#E2261C'
                c.fillRect(cx - bw / 2, H - 54, bw * bp, 2)
                c.restore()
            }
        }
        if (clipped) c.restore()
    }

    /** Upload khung scene hiện tại lên texture (cấp phát lần đầu / sau resize, các khung sau chỉ ghi đè) */
    function uploadScene() {
        const { gl, tex } = g!
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, tex)
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
        if (g!.texW !== sc!.width || g!.texH !== sc!.height) {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sc!)
            g!.texW = sc!.width
            g!.texH = sc!.height
        } else {
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, sc!)
        }
    }

    function drawWater(wt: number) {
        const { gl, uni, canvas } = g!
        gl.viewport(0, 0, canvas.width, canvas.height)
        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT)
        gl.uniform1i(uni.S, 0)
        gl.uniform2f(uni.R, canvas.width, canvas.height)
        gl.uniform1f(uni.t, wt)
        gl.uniform2f(uni.I, ((IMPACT[0] * W) / H) * 1.25, IMPACT[1])
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }

    /* ----- kết thúc / lỗi ----- */
    function finish() {
        if (finished) return
        finished = true
        cancelAnimationFrame(raf)
        clearTimeout(timer)
        el!.removeEventListener('click', onSkip)
        window.removeEventListener('keydown', onKey, true)
        window.removeEventListener('resize', onResize)
        window.removeEventListener('orbit:page-ready', onPageReady)
        // Giữ context, program, texture và các canvas đã cấp phát cho lần sau; chỉ ẩn canvas GL
        if (g) g.canvas.style.display = 'none'
        el!.classList.remove('on', 'water')
        el!.setAttribute('aria-hidden', 'true')
        sc!.style.cssText = ''
        active = false
        abort = null
        introMark('finish')
        if (DEBUG) report()
        window.dispatchEvent(new Event('orbit:intro-done'))
        doneWaiters.splice(0).forEach((r) => r())
        resolve()
    }

    const fail = (e: unknown) => {
        console.error('Intro lỗi, bỏ qua', e)
        swap()
        finish()
    }

    /** ?introdebug: bảng các khung có khoảng cách > 20ms kèm mốc gần nhất, và tổng kết */
    function report() {
        const fr = dbg.frames
        if (!fr.length) return
        const slow = fr
            .filter((f) => f.gap > 20)
            .map((f) => {
                const m = [...dbg.marks].reverse().find((x) => x.vt <= f.vt)
                return { vt: f.vt, phase: f.phase, gap_ms: f.gap, js_ms: f.js, mốc_gần_nhất: m ? `${m.name} (+${(f.vt - m.vt).toFixed(3)}s)` : '-' }
            })
        const gaps = fr.slice(1).map((f) => f.gap)
        console.info('[introdebug] mốc:', dbg.marks.map((m) => `${m.name}@${m.vt}s`).join(' · '))
        if (slow.length) console.table(slow)
        console.info(`[introdebug] ${fr.length} khung · gap TB ${(gaps.reduce((a, b) => a + b, 0) / Math.max(1, gaps.length)).toFixed(1)}ms · gap lớn nhất ${Math.max(0, ...gaps).toFixed(1)}ms · ${slow.length} khung > 20ms`)
    }

    function tick(now: number) {
        if (finished) return
        const j0 = DEBUG ? performance.now() : 0
        try {
            const gap = (now - last) / 1000
            const dt = Math.min(0.1, gap)
            last = now
            if (skipRate > 0 && vt < T.tan) vt = Math.min(T.tan, vt + dt * skipRate)
            else vt += dt
            if (!swapped && vt >= T.swap) swap()
            draw(vt)
            // Upload texture bắt đầu 0,1s TRƯỚC mốc tan (GL còn ẩn) để khung đầu tiên hiện GL không phải khung upload đầu tiên
            if (g && !uploaded && vt >= T.tan - 0.1) {
                uploaded = true
                introMark('upload đầu')
            }
            // Tới mốc tan: nếu trang đích chưa báo sẵn sàng thì giữ pha cảnh (camera, quỹ đạo vẫn chạy) tối đa PAGE_WAIT giây
            if (tanAt < 0 && vt >= T.tan) {
                if (swapped && expectPage && !pageReady && vt < T.tan + PAGE_WAIT) {
                    if (!waited) {
                        waited = true
                        introMark('chờ page-ready')
                    }
                } else {
                    tanAt = vt
                    if (waited && !pageReady) introMark('hết hạn chờ page-ready, tan')
                }
            }
            if (g && uploaded && tanAt < 0) {
                uploadScene()
                drawWater(-1)
            }
            if (tanAt >= 0) {
                if (phase === 'scene') {
                    phase = g ? 'water' : 'fade'
                    el!.classList.add('water')
                    if (!g) {
                        // Không có WebGL: cảnh mờ dần 600ms
                        fadeStart = vt
                        sc!.style.transition = 'opacity 600ms ease'
                        sc!.style.opacity = '0'
                    }
                }
                const wt = vt - tanAt
                if (phase === 'water') {
                    uploadScene()
                    drawWater(wt)
                    if (g!.canvas.style.display !== 'block') {
                        g!.canvas.style.display = 'block'
                        sc!.style.visibility = 'hidden'
                        introMark('hiện GL')
                    }
                    if (wt > T.water) return finish()
                } else {
                    if (!landedSent && vt - fadeStart >= 0.4) {
                        landedSent = true
                        window.dispatchEvent(new Event('orbit:intro-landed'))
                    }
                    if (vt - fadeStart >= 0.65) return finish()
                }
                if (phase === 'water' && !landedSent && wt >= LANDED_AT) {
                    landedSent = true
                    window.dispatchEvent(new Event('orbit:intro-landed'))
                }
            }
            if (DEBUG) dbg.frames.push({ vt: +vt.toFixed(3), phase, gap: +(gap * 1000).toFixed(1), js: +(performance.now() - j0).toFixed(1) })
            raf = requestAnimationFrame(tick)
        } catch (e) {
            fail(e)
        }
    }

    /* ----- bỏ qua + resize ----- */
    function onSkip() {
        if (finished || phase !== 'scene' || vt >= T.tan || skipRate > 0) return
        skipRate = Math.max(1, (T.tan - vt) / (SKIP_MS / 1000))
        swap()
    }
    function onKey(e: KeyboardEvent) {
        if (e.key === 'Enter' || e.key === 'Escape') {
            e.preventDefault()
            e.stopPropagation()
            onSkip()
        }
    }
    function onResize() {
        resize()
        if (phase === 'hold') draw(T.tan)
    }

    /* ----- khởi động ----- */
    active = true
    abort = finish
    if (DEBUG) {
        dbg.frames = []
        dbg.marks = []
        dbg.t0 = performance.now()
    }
    el.classList.add('on')
    el.setAttribute('aria-hidden', 'false')
    el.addEventListener('click', onSkip)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('resize', onResize)
    window.addEventListener('orbit:page-ready', onPageReady)

    const begin = () => {
        L = layersOk
        g = reduce ? null : ensureGPU()
        resize()
        if (reduce) return false
        // Khung đầu vẽ đồng bộ ngay trong lời gọi (ảnh/font đã sẵn) rồi mới vào rAF
        draw(0.001)
        last = performance.now()
        raf = requestAnimationFrame(tick)
        return true
    }

    if (layersOk && fontsOk && !reduce) {
        try {
            begin()
        } catch (e) {
            fail(e)
        }
        return done
    }

    ;(async () => {
        try {
            const [layers] = await Promise.all([preloadImages(), preloadFonts()])
            if (finished) return
            layersOk = layers
            if (begin()) return
            // Giảm chuyển động: khung cuối tĩnh ~900ms, đổi vai, mờ 600ms
            phase = 'hold'
            draw(T.tan)
            await new Promise((r) => setTimeout(r, 900))
            if (finished) return
            swap()
            await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
            if (finished) return
            el.classList.add('water')
            sc.style.transition = 'opacity 600ms ease'
            sc.style.opacity = '0'
            timer = window.setTimeout(finish, 650)
        } catch (e) {
            fail(e)
        }
    })()

    return done
}
