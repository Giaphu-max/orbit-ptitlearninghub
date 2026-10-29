// Intro sau khi chọn / đổi vai trò (theo docs/mockup/intro/ptit-intro-splash.html, dựng bằng Canvas 2D + WebGL).
// Màn đỏ lan từ thẻ vừa bấm → iris trắng mở ra logo gốc của trường (vòng, P-T-I-T, sao, sách) → dòng chữ Học viện → màn "tan" như
// màng nước trên kính: đổi vai + chuyển trang phía sau, lỗ thủng lộ trang thật. Bấm / Enter / Esc nhảy thẳng tới bước tan.
// Một vòng rAF riêng, dừng khi intro đóng.

import { INTRO_PARTS, META, type IntroPart } from '@/lib/intro-meta'

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

export const bindIntro = (r: HTMLElement | null) => {
    if (!r) abort?.()
    root = r
    if (r) void preloadImages()
}
export const introReady = () => root !== null
/** Intro đang chạy: không chạy chồng hai lần, không cho đổi giao diện chen vào. */
export const introPlaying = () => active

/* ---------- hằng số mockup ---------- */
// Mốc thời gian (giây) của mockup; t = 0 là lúc màn đỏ đã lan kín (chấm sáng bắt đầu).
const T = { iris: [0.38, 1.15], ring: [0.85, 2.05], letters: 1.55, star: 2.05, book: 2.2, word: 2.4, sub: 2.7, greet: 2.95, sheen: [3.05, 3.75], splash: 4.0, water: 2.65 }
/** Màn đỏ lan từ tâm thẻ vừa bấm trước khi vào timeline mockup */
const SPREAD = 0.65
const LANDED_AT = 1.2

const SANS = '"Be Vietnam Pro", system-ui, sans-serif'
const MONO = '"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, monospace'

const cl = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x))
const prog = (t: number, a: number, d: number) => cl((t - a) / d)
const eoc = (x: number) => 1 - Math.pow(1 - x, 3)
const eoq = (x: number) => 1 - Math.pow(1 - x, 4)
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
    imagesP.catch(() => (imagesP = null))
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

interface GLState {
    gl: WebGLRenderingContext
    tex: WebGLTexture
    uni: Record<'S' | 'R' | 't' | 'I', WebGLUniformLocation | null>
}

function initGL(glc: HTMLCanvasElement): GLState | null {
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
    gl.bindTexture(gl.TEXTURE_2D, tex)
    ;[gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach((p) => gl.texParameteri(gl.TEXTURE_2D, p, gl.CLAMP_TO_EDGE))
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    return { gl, tex, uni }
}

const IMPACT = [0.36, 0.62]

/* ---------- phát intro ---------- */
export function playRoleIntro(origin: { x: number; y: number }, info: IntroInfo, hooks: IntroHooks): Promise<void> {
    const el = root
    if (!el || active) {
        hooks.swap()
        return Promise.resolve()
    }
    const sc = el.querySelector<HTMLCanvasElement>('[data-ri="scene"]')
    const glSlot = el.querySelector<HTMLCanvasElement>('[data-ri="gl"]')
    const ctx = sc?.getContext('2d')
    if (!sc || !glSlot || !ctx) {
        hooks.swap()
        return Promise.resolve()
    }
    let glc = glSlot
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const greeting = `${info.words.map((w) => w.text).join(' ').replace(/,\s*$/, '')} · ${info.loadText}`.toUpperCase()

    let W = 0
    let H = 0
    let DPR = 1
    let swapped = false
    let finished = false
    let raf = 0
    let timer = 0
    let phase: 'scene' | 'hold' | 'water' | 'fade' = 'scene'
    let t0 = 0
    let glState: GLState | null = null
    let L: Layers | null = null
    let resolve!: () => void
    const done = new Promise<void>((res) => (resolve = res))
    const lay = document.createElement('canvas')
    const lctx = lay.getContext('2d')
    let landedSent = false

    const swap = () => {
        if (swapped) return
        swapped = true
        try {
            hooks.swap()
        } catch (e) {
            console.error(e)
        }
    }

    const resize = () => {
        DPR = Math.min(2, window.devicePixelRatio || 1)
        W = window.innerWidth
        H = window.innerHeight
        sc.width = Math.round(W * DPR)
        sc.height = Math.round(H * DPR)
        const gd = Math.min(DPR, 2, 2880 / W)
        glc.width = Math.round(W * gd)
        glc.height = Math.round(H * gd)
    }

    /* ----- vẽ cảnh (Canvas 2D) ----- */
    function orbits(c: CanvasRenderingContext2D, t: number, cx: number, cy: number) {
        const base = Math.min(W, H)
        const defs = [
            [0.62, 0.3, 0.26, 0.95],
            [0.82, 0.36, 0.16, 1.08],
            [1.06, 0.42, 0.1, 1.2],
        ]
        defs.forEach(([rx, ry, a, del], i) => {
            const p = eoc(prog(t, del, 1.3))
            if (p <= 0) return
            const rot = ((-24 + i * 7) * Math.PI) / 180 + t * 0.03 * (i % 2 ? -1 : 1)
            c.save()
            c.translate(cx, cy)
            c.rotate(rot)
            c.strokeStyle = 'rgba(212,31,22,' + a + ')'
            c.lineWidth = i === 0 ? 1.6 : 1.2
            if (i === 1) c.setLineDash([2, 7])
            c.beginPath()
            c.ellipse(0, 0, base * rx, ((base * rx * ry) / 0.62) * 0.62, 0, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2)
            c.stroke()
            // vệ tinh
            if (p >= 1 || i === 0) {
                const th = -Math.PI / 2 + p * Math.PI * 2 + (t - del - 1.3 > 0 ? (t - del - 1.3) * 0.9 : 0) * (i === 1 ? -1 : 1)
                const x = Math.cos(th) * base * rx
                const y = Math.sin(th) * base * rx * ry
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
                    const g = c.createRadialGradient(hx, hy, 0, hx, hy, 46 * s)
                    g.addColorStop(0, 'rgba(255,255,255,' + 0.95 * A + ')')
                    g.addColorStop(0.18, 'rgba(255,120,96,' + 0.85 * A + ')')
                    g.addColorStop(1, 'rgba(226,38,28,0)')
                    c.fillStyle = g
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

    /** Vẽ khung tại thời điểm t của mockup (t < 0: màn đỏ đang lan từ chỗ bấm). */
    function draw(t: number) {
        const c = ctx!
        c.setTransform(DPR, 0, 0, DPR, 0, 0)
        c.clearRect(0, 0, W, H)
        const cx = W / 2
        const cy = H * 0.42
        const diag = Math.hypot(W, H)
        // nền đỏ
        const rg = c.createRadialGradient(cx, cy, 0, cx, cy, diag * 0.7)
        rg.addColorStop(0, '#F0392C')
        rg.addColorStop(0.55, '#D41F16')
        rg.addColorStop(1, '#9E120C')
        c.fillStyle = rg
        if (t < 0) {
            const R = Math.hypot(Math.max(origin.x, W - origin.x), Math.max(origin.y, H - origin.y)) + 20
            const p = eio(cl((t + SPREAD) / SPREAD))
            c.save()
            c.beginPath()
            c.arc(origin.x, origin.y, p * R, 0, 7)
            c.clip()
            c.fillRect(0, 0, W, H)
            c.restore()
            return
        }
        c.fillRect(0, 0, W, H)
        // chấm sáng trước iris
        const sp = prog(t, 0.08, 0.3)
        if (t < T.iris[0] + 0.1) {
            c.fillStyle = 'rgba(255,255,255,' + sp * 0.95 + ')'
            c.beginPath()
            c.arc(cx, cy, 2 + eoc(sp) * 7 + Math.sin(t * 30) * 0.6, 0, 7)
            c.fill()
            c.strokeStyle = 'rgba(255,255,255,' + 0.5 * (1 - sp) + ')'
            c.lineWidth = 1.5
            c.beginPath()
            c.arc(cx, cy, 10 + sp * 60, 0, 7)
            c.stroke()
        }
        // iris → nền trắng
        const ip = eoq(prog(t, T.iris[0], T.iris[1] - T.iris[0]))
        const R = ip * diag * 0.62
        if (ip > 0) {
            c.save()
            c.beginPath()
            c.arc(cx, cy, R, 0, 7)
            c.clip()
            c.fillStyle = '#FFFFFF'
            c.fillRect(0, 0, W, H)
            // mảng đỏ loang ở các góc; giữa vẫn trắng cho logo nổi bật
            const blob = (x: number, y: number, r: number, col: string, a: number) => {
                const g = c.createRadialGradient(x, y, 0, x, y, r)
                g.addColorStop(0, 'rgba(' + col + ',' + a + ')')
                g.addColorStop(0.55, 'rgba(' + col + ',' + a * 0.35 + ')')
                g.addColorStop(1, 'rgba(' + col + ',0)')
                c.fillStyle = g
                c.fillRect(0, 0, W, H)
            }
            const dr = Math.sin(t * 0.6) * 0.015
            const M = Math.max(W, H)
            blob(W * (1.02 + dr), H * -0.05, M * 0.55, '226,38,28', 0.3)
            blob(W * (0.86 - dr), H * 0.1, M * 0.26, '255,90,71', 0.18)
            blob(W * -0.04, H * (1.06 + dr), M * 0.5, '200,27,18', 0.26)
            blob(W * (0.14 + dr), H * 0.96, M * 0.22, '244,135,143', 0.2)
            blob(W * 1.0, H * 1.02, M * 0.24, '226,38,28', 0.1)
            blob(cx, cy, Math.min(W, H) * 0.42, '255,255,255', 0.9)
            orbits(c, t, cx, cy)
            c.restore()
            if (ip < 1) {
                c.strokeStyle = 'rgba(255,255,255,.9)'
                c.lineWidth = 2
                c.beginPath()
                c.arc(cx, cy, R + 4, 0, 7)
                c.stroke()
                c.strokeStyle = 'rgba(255,255,255,' + 0.35 * (1 - ip) + ')'
                c.lineWidth = 1
                c.beginPath()
                c.arc(cx, cy, R * 1.12 + 14, 0, 7)
                c.stroke()
            }
        }
        if (t < T.ring[0] - 0.1) return
        // logo
        const LH = Math.min(H * 0.4, 380)
        const k = LH / 763
        const g = 1.075 - 0.075 * eoc(prog(t, 0.85, 3.0))
        const lw = Math.ceil(600 * k * DPR * g)
        const lh = Math.ceil(763 * k * DPR * g)
        if (lay.width !== lw || lay.height !== lh) {
            lay.width = lw
            lay.height = lh
        }
        drawLogo(lctx!, t, lw / 600)
        c.drawImage(lay, cx - lw / DPR / 2, cy - lh / DPR / 2, lw / DPR, lh / DPR)
        // dòng chữ Học viện
        const fs = Math.round(cl(W * 0.0165, 18, 30))
        const wy = cy + (LH * g) / 2 + fs * 2.0
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
            const bp = eio(prog(t, T.greet, T.splash - T.greet))
            c.fillStyle = 'rgba(226,38,28,.15)'
            c.fillRect(cx - bw / 2, H - 54, bw, 2)
            c.fillStyle = '#E2261C'
            c.fillRect(cx - bw / 2, H - 54, bw * bp, 2)
            c.restore()
        }
    }

    function drawWater(wt: number) {
        const s = glState
        if (!s) return
        const { gl, uni } = s
        gl.viewport(0, 0, glc.width, glc.height)
        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT)
        gl.uniform1i(uni.S, 0)
        gl.uniform2f(uni.R, glc.width, glc.height)
        gl.uniform1f(uni.t, wt)
        gl.uniform2f(uni.I, (IMPACT[0] * W) / H * 1.25, IMPACT[1])
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
        try {
            glState?.gl.getExtension('WEBGL_lose_context')?.loseContext()
        } catch {
            /* bỏ qua */
        }
        // Canvas đã mất context không dùng lại được: thay bằng canvas mới cho lần sau
        const fresh = glc.cloneNode(false) as HTMLCanvasElement
        fresh.removeAttribute('width')
        fresh.removeAttribute('height')
        fresh.style.display = 'none'
        glc.replaceWith(fresh)
        glState = null
        el!.classList.remove('on', 'water')
        el!.setAttribute('aria-hidden', 'true')
        sc!.style.cssText = ''
        sc!.width = sc!.height = 1
        active = false
        abort = null
        resolve()
    }

    const fail = (e: unknown) => {
        console.error('Intro lỗi, bỏ qua', e)
        swap()
        finish()
    }

    const waitRender = () =>
        Promise.race([new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))), new Promise<void>((r) => setTimeout(r, 500))])

    /** Bước tan: vẽ khung cuối, đổi vai + chuyển trang, rồi để lớp màng tan ra lộ trang thật. */
    async function splash() {
        phase = 'hold'
        cancelAnimationFrame(raf)
        try {
            draw(T.splash)
            swap()
            el!.classList.add('water')
            await waitRender()
            if (finished) return
            draw(T.splash)
            if (glState) {
                const { gl, tex } = glState
                gl.activeTexture(gl.TEXTURE0)
                gl.bindTexture(gl.TEXTURE_2D, tex)
                gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sc!)
                glc.style.display = 'block'
                sc!.style.visibility = 'hidden'
                phase = 'water'
                t0 = performance.now()
                raf = requestAnimationFrame(tick)
            } else {
                phase = 'fade'
                sc!.style.transition = 'opacity 600ms ease'
                sc!.style.opacity = '0'
                window.setTimeout(() => window.dispatchEvent(new Event('orbit:intro-landed')), 400)
                timer = window.setTimeout(finish, 650)
            }
        } catch (e) {
            fail(e)
        }
    }

    function tick(now: number) {
        if (finished) return
        try {
            if (phase === 'scene') {
                const t = (now - t0) / 1000 - SPREAD
                if (t >= T.splash) {
                    void splash()
                    return
                }
                draw(t)
            } else if (phase === 'water') {
                const wt = (now - t0) / 1000
                drawWater(wt)
                if (!landedSent && wt >= LANDED_AT) {
                    landedSent = true
                    window.dispatchEvent(new Event('orbit:intro-landed'))
                }
                if (wt > T.water) {
                    finish()
                    return
                }
            }
            raf = requestAnimationFrame(tick)
        } catch (e) {
            fail(e)
        }
    }

    /* ----- bỏ qua + resize ----- */
    function onSkip() {
        if (finished || phase !== 'scene') return
        t0 = performance.now() - (SPREAD + T.splash) * 1000
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
        if (phase === 'hold' || phase === 'fade') draw(T.splash)
    }

    /* ----- khởi động ----- */
    active = true
    abort = finish
    el.classList.add('on')
    el.setAttribute('aria-hidden', 'false')
    resize()
    el.addEventListener('click', onSkip)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('resize', onResize)

    ;(async () => {
        try {
            const [layers] = await Promise.all([
                preloadImages(),
                Promise.all([document.fonts.load('800 24px "Be Vietnam Pro"'), document.fonts.load('500 14px "Be Vietnam Pro"'), document.fonts.load('700 12px "JetBrains Mono Variable"')]).catch(() => undefined),
            ])
            if (finished) return
            L = layers
            glState = reduce ? null : initGL(glc)
            if (reduce) {
                // Giảm chuyển động: khung cuối tĩnh ~900ms, đổi vai, mờ 600ms
                phase = 'hold'
                draw(T.splash)
                await new Promise((r) => setTimeout(r, 900))
                if (finished) return
                swap()
                await waitRender()
                if (finished) return
                phase = 'fade'
                el.classList.add('water')
                sc.style.transition = 'opacity 600ms ease'
                sc.style.opacity = '0'
                timer = window.setTimeout(finish, 650)
                return
            }
            t0 = performance.now()
            raf = requestAnimationFrame(tick)
        } catch (e) {
            fail(e)
        }
    })()

    return done
}
