import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";
import { Captions, Maximize, Pause, PanelRight, Play } from "lucide-react";
import type { Lesson } from "@/data/types";
import { formatTime } from "@/lib/youtube";
import type { QuizResult } from "@/store/useOrbitStore";

export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5] as const;

interface PlayerControlsProps {
  lesson: Lesson;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  rate: number;
  results: Record<string, QuizResult>;
  captionsOn: boolean;
  panelHidden: boolean;
  onToggle: () => void;
  onSeek: (sec: number) => void;
  onToggleCaptions: () => void;
  onRate: (rate: number) => void;
  onFullscreen: () => void;
  onTogglePanel: () => void;
  /** Có trình phát thật: bật lớp bắt click (play/pause, nhấp đúp = toàn màn hình) */
  interactive: boolean;
  /** Quiz đang mở hoặc vòng củng cố đang chạy: thanh luôn hiện */
  pinned: boolean;
  /** Báo ra ngoài khi thanh ẩn/hiện (nút thoát tập trung và tên bài mờ theo) */
  onVisibleChange?: (visible: boolean) => void;
  youtubeId: string;
  /** Nhãn góc trên trái của pause screen: "Bài 1/3 · tên bài" */
  label: string;
  isBuffering: boolean;
  /** Đã từng phát: chưa phát thì pause screen dùng thumbnail làm nền */
  started: boolean;
  /** Tua tương đối (±10s khi nhấp đúp hai bên); giữ nguyên trạng thái phát/dừng */
  onSeekBy: (delta: number) => void;
  fxRef?: Ref<PlayerFx>;
  /** Trang duyệt của giảng viên: trạng thái mốc câu hỏi (mặc định theo kết quả làm bài của sinh viên) */
  quizMarker?: (q: Lesson["quiz"][number]) => { state: "approved" | "pending" | "hot"; hint: string; current?: boolean };
  /** Bấm mốc câu hỏi (mặc định: tua tới mốc) */
  onMarkerClick?: (q: Lesson["quiz"][number]) => void;
  hidePanelToggle?: boolean;
  /** Gọn: bỏ nút tốc độ và toàn màn hình (trang duyệt của giảng viên) */
  compact?: boolean;
}

/** Hiệu ứng phản hồi gọi từ ngoài (phím tắt) để dùng chung với thao tác chuột. */
export interface PlayerFx {
  flash: (kind: "play" | "pause") => void;
  seek: (delta: number) => void;
  volume: (value: number) => void;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Tô từ khóa trùng tên khái niệm trong dòng phụ đề. */
function highlight(text: string, names: string[]): ReactNode {
  if (!names.length) return text;
  const re = new RegExp(`(${names.map(escapeRe).join("|")})`, "gi");
  return text.split(re).map((part, i) =>
    i % 2 === 1 ? (
      <b key={i} className="font-bold text-brand-light">
        {part}
      </b>
    ) : (
      part
    ),
  );
}

const btn =
  "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-bold transition duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-foreground";
const btnOff =
  "border-ink-foreground/35 bg-ink-foreground/10 text-ink-foreground hover:bg-ink-foreground/20";
const btnOn = "border-ink-foreground bg-ink-foreground text-ink";

/** Phụ đề + pause screen + lớp bắt thao tác + thanh tua + điều khiển đè lên khung video. Chuột không bao giờ chạm iframe. */
export function PlayerControls(p: PlayerControlsProps) {
  const { lesson, currentTime, isPlaying, rate, results } = p;
  const duration = Math.max(p.duration || lesson.durationSec, 1);
  const pct = (sec: number) =>
    `${Math.min(100, Math.max(0, (sec / duration) * 100))}%`;

  // ── Tự ẩn như YouTube ──
  const [recent, setRecent] = useState(true);
  const [focusWithin, setFocusWithin] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrub, setScrub] = useState<number | null>(null);
  const [hoverPct, setHoverPct] = useState<number | null>(null);
  const hideTimer = useRef<number | undefined>(undefined);

  const poke = useCallback((delay: number) => {
    window.clearTimeout(hideTimer.current);
    setRecent(true);
    hideTimer.current = window.setTimeout(() => setRecent(false), delay);
  }, []);

  // Lắng nghe chuột/focus trên khung player (phần tử cha của lớp này), không cần đụng tới LessonPlayer
  const sentinel = useCallback(
    (node: HTMLSpanElement | null) => {
      const el = node?.parentElement;
      if (!el) return;
      const move = () => poke(2500);
      const leave = () => poke(500);
      const fin = () => setFocusWithin(true);
      const fout = (e: FocusEvent) => {
        if (!el.contains(e.relatedTarget as Node | null)) setFocusWithin(false);
      };
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerdown", move);
      el.addEventListener("pointerleave", leave);
      el.addEventListener("focusin", fin);
      el.addEventListener("focusout", fout);
      return () => {
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerdown", move);
        el.removeEventListener("pointerleave", leave);
        el.removeEventListener("focusin", fin);
        el.removeEventListener("focusout", fout);
      };
    },
    [poke],
  );
  useEffect(() => () => window.clearTimeout(hideTimer.current), []);

  const visible =
    !isPlaying || p.pinned || recent || focusWithin || dragging || menuOpen;
  const { onVisibleChange } = p;
  useEffect(() => onVisibleChange?.(visible), [visible, onVisibleChange]);
  const cursorHidden = !visible && isPlaying;

  // ── Hiệu ứng phản hồi (mỗi lần bấm đổi key để chạy lại animation CSS) ──
  const [flash, setFlash] = useState<{
    key: number;
    kind: "play" | "pause";
  } | null>(null);
  const flashTimer = useRef<number | undefined>(undefined);

  const triggerFlash = useCallback((kind: "play" | "pause") => {
    window.clearTimeout(flashTimer.current);
    setFlash({ key: Date.now(), kind });
    flashTimer.current = window.setTimeout(() => setFlash(null), 500);
  }, []);

  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  const [seekFx, setSeekFx] = useState<{
    key: number;
    side: "left" | "right";
    secs: number;
  } | null>(null);
  const [volFx, setVolFx] = useState<{ key: number; value: number } | null>(
    null,
  );
  useImperativeHandle(
    p.fxRef,
    () => ({
      flash: triggerFlash,
      seek: (delta) =>
        setSeekFx({
          key: Date.now(),
          side: delta < 0 ? "left" : "right",
          secs: Math.abs(delta),
        }),
      volume: (value) => setVolFx({ key: Date.now(), value }),
    }),
    [triggerFlash],
  );

  // Spinner đệm chỉ hiện sau 300ms để không nháy mỗi lần tua
  const [spinner, setSpinner] = useState(false);
  useEffect(() => {
    if (!p.isBuffering) {
      setSpinner(false);
      return;
    }
    const t = window.setTimeout(() => setSpinner(true), 300);
    return () => window.clearTimeout(t);
  }, [p.isBuffering]);

  // Thumbnail làm nền khi chưa từng phát video
  const [thumb, setThumb] = useState<"maxresdefault" | "hqdefault">(
    "maxresdefault",
  );

  // Nhấp đơn = phát/dừng (hoãn 220ms để phân biệt nhấp đúp); nhấp đúp trái/phải = ±10s, giữa = toàn màn hình
  const clickTimer = useRef<number | undefined>(undefined);
  const onLayerClick = () => {
    window.clearTimeout(clickTimer.current);
    clickTimer.current = window.setTimeout(p.onToggle, 220);
  };
  const onLayerDouble = (e: React.MouseEvent<HTMLDivElement>) => {
    window.clearTimeout(clickTimer.current);
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    if (x < 1 / 3) p.onSeekBy(-10);
    else if (x > 2 / 3) p.onSeekBy(10);
    else p.onFullscreen();
  };
  useEffect(() => () => window.clearTimeout(clickTimer.current), []);

  // Mỗi đoạn một khái niệm theo mốc bắt đầu, đoạn cuối chạy tới hết video; phần trước khái niệm đầu là "Mở đầu"
  const chapters = useMemo(() => {
    const sorted = [...lesson.concepts].sort(
      (a, b) => a.segment.start - b.segment.start,
    );
    const out: { name: string; start: number; end: number }[] = [];
    if (sorted.length && sorted[0].segment.start > 1)
      out.push({ name: "Mở đầu", start: 0, end: sorted[0].segment.start });
    sorted.forEach((c, i) =>
      out.push({
        name: c.name,
        start: c.segment.start,
        end: sorted[i + 1]?.segment.start ?? duration,
      }),
    );
    return out.length ? out : [{ name: lesson.title, start: 0, end: duration }];
  }, [lesson, duration]);

  const names = useMemo(
    () => lesson.concepts.map((c) => c.name).filter(Boolean),
    [lesson.concepts],
  );
  const caption = lesson.transcript.find(
    (s) => currentTime >= s.start && currentTime < s.end,
  );
  const shownTime = scrub ?? currentTime;
  const hoverTime = hoverPct === null ? null : (hoverPct / 100) * duration;
  const hoverChapter =
    hoverTime === null
      ? null
      : (chapters.find((c) => hoverTime >= c.start && hoverTime < c.end) ??
        chapters[chapters.length - 1]);

  // Kéo thanh tua: đầu phát chạy theo con trỏ (pointer capture), tua thật khi thả
  const timeFromPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return Math.min(
      duration,
      Math.max(0, ((e.clientX - rect.left) / rect.width) * duration),
    );
  };
  const onSeekDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    setScrub(timeFromPointer(e));
  };
  const onSeekMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const t = timeFromPointer(e);
    setHoverPct((t / duration) * 100);
    if (dragging) setScrub(t);
  };
  const onSeekUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragging(false);
    setScrub(null);
    p.onSeek(timeFromPointer(e));
  };

  return (
    <>
      <span ref={sentinel} hidden />

      {/* Thumbnail nền khi chưa từng phát video */}
      {p.interactive && !p.started && (
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-0 z-[5] transition-opacity duration-200 ${
            !isPlaying ? "opacity-100" : "opacity-0"
          }`}
        >
          <img
            src={`https://i.ytimg.com/vi/${p.youtubeId}/${thumb}.jpg`}
            alt=""
            onError={() => setThumb("hqdefault")}
            className="absolute inset-0 h-full w-full bg-ink object-cover"
          />
        </div>
      )}

      {/* Dòng tiêu đề nhỏ góc trên trái: CHỈ hiện trong CHẾ ĐỘ TẬP TRUNG, ẩn/hiện đồng bộ với controls */}
      {p.panelHidden && (
        <div
          aria-hidden
          className={`pointer-events-none absolute left-4 top-4 z-20 max-w-[70%] truncate text-[13px] font-semibold text-ink-foreground/90 drop-shadow transition-opacity duration-200 motion-reduce:transition-none ${
            visible ? "opacity-100" : "opacity-0"
          }`}
        >
          {p.label}
        </div>
      )}

      {/* Lớp bắt thao tác phủ kín iframe */}
      {p.interactive && (
        <div
          onClick={onLayerClick}
          onDoubleClick={onLayerDouble}
          onWheel={(e) => e.stopPropagation()}
          aria-hidden
          className={`absolute inset-0 z-10 ${cursorHidden ? "cursor-none" : ""}`}
        />
      )}

      {/* Nút Play tròn to giữa màn: CHỈ hiện khi tạm dừng + controlsVisible, mờ đi ngay khi phát */}
      {p.interactive && (
        <CenterPlay
          visible={visible}
          isPlaying={isPlaying}
          isBuffering={p.isBuffering}
        />
      )}

      {/* Flash icon khi bấm phát/dừng: 500ms rồi biến mất, không đọng lại */}
      <FlashIcon flash={flash} onEnd={() => setFlash(null)} />

      {/* Phản hồi: vệt tua ±s, chip âm lượng, spinner đệm */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[12] overflow-hidden"
      >
        {seekFx && (
          <span
            key={seekFx.key}
            className={`yt-seekfx absolute inset-y-0 flex w-[30%] items-center justify-center bg-ink-foreground/20 text-sm font-bold text-ink-foreground ${
              seekFx.side === "left"
                ? "left-0 rounded-r-[50%]"
                : "right-0 rounded-l-[50%]"
            }`}
          >
            {seekFx.side === "left"
              ? `« ${seekFx.secs} giây`
              : `${seekFx.secs} giây »`}
          </span>
        )}
        {volFx && (
          <span
            key={volFx.key}
            className="yt-chip absolute left-1/2 top-5 -translate-x-1/2 rounded-full bg-ink/70 px-4 py-1.5 text-[13px] font-bold text-ink-foreground"
          >
            Âm lượng {volFx.value}%
          </span>
        )}
        {spinner && (
          <span className="absolute left-1/2 top-1/2 -ml-6 -mt-6 h-12 w-12 animate-spin rounded-full border-2 border-ink-foreground/25 border-t-ink-foreground" />
        )}
      </div>

      {p.captionsOn && caption && (
        <div
          className={`pointer-events-none absolute left-1/2 z-[11] max-w-[70%] -translate-x-1/2 rounded-[10px] bg-ink/70 px-4 py-2 text-center text-base font-semibold leading-snug text-ink-foreground transition-[bottom] duration-200 motion-reduce:transition-none ${
            visible ? "bottom-[76px]" : "bottom-6"
          }`}
        >
          {highlight(caption.text, names)}
        </div>
      )}

      <div
        inert={!visible}
        className={`absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-ink/70 to-transparent px-[18px] pb-3.5 pt-8 transition-[opacity,transform] duration-200 motion-reduce:transform-none motion-reduce:duration-100 ${
          visible
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-1.5 opacity-0"
        }`}
      >
        <div
          role="slider"
          tabIndex={0}
          aria-label="Thanh tua video"
          aria-valuemin={0}
          aria-valuemax={Math.floor(duration)}
          aria-valuenow={Math.floor(shownTime)}
          aria-valuetext={`${formatTime(shownTime)} trên ${formatTime(duration)}`}
          data-dragging={dragging}
          onPointerDown={onSeekDown}
          onPointerMove={onSeekMove}
          onPointerUp={onSeekUp}
          onPointerLeave={() => setHoverPct(null)}
          onPointerCancel={() => {
            setDragging(false);
            setScrub(null);
          }}
          className="group relative flex h-[22px] cursor-pointer touch-none items-center"
        >
          {/* Rãnh 4px, hover 7px (scaleY, không đổi layout) */}
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 transition-transform duration-150 group-hover:scale-y-[1.75] group-data-[dragging=true]:scale-y-[1.75] motion-reduce:transition-none">
            <div className="absolute inset-0 flex gap-[3px]">
              {chapters.map((c) => (
                <span
                  key={c.start}
                  style={{ flex: Math.max(c.end - c.start, 1) }}
                  className="h-full rounded-sm bg-ink-foreground/30"
                />
              ))}
            </div>
            <span
              className="pointer-events-none absolute left-0 h-full rounded-sm bg-brand-600"
              style={{ width: pct(shownTime) }}
            />
          </div>
          {lesson.quiz.map((q) => {
            const review = p.quizMarker?.(q);
            const done = review ? review.state === "approved" : !!results[q.id];
            const tone = review
              ? review.state === "approved"
                ? "border-mm-teal bg-mm-teal"
                : review.state === "hot"
                  ? "border-ink-foreground bg-brand-600"
                  : "border-ink bg-ink-foreground"
              : done
                ? "border-success bg-success"
                : "border-ink bg-ink-foreground";
            const hint = review ? review.hint : `Quiz ${formatTime(q.pauseAt)}${done ? " · đã làm" : ""}`;
            return (
              <button
                key={q.id}
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  if (p.onMarkerClick) p.onMarkerClick(q);
                  else p.onSeek(q.pauseAt);
                }}
                aria-label={review ? hint : `Tua tới quiz ${formatTime(q.pauseAt)}${done ? ", đã làm" : ""}`}
                data-t={hint}
                style={{ left: pct(q.pauseAt) }}
                className={`absolute top-1/2 z-[2] -ml-1.5 -mt-1.5 h-3 w-3 rotate-45 rounded-[2px] border-2 p-0 after:pointer-events-none after:absolute after:bottom-4 after:left-1/2 after:-translate-x-1/2 after:-rotate-45 after:whitespace-nowrap after:rounded-md after:bg-ink after:px-2 after:py-1 after:text-[11.5px] after:font-semibold after:text-ink-foreground after:opacity-0 after:content-[attr(data-t)] hover:after:opacity-100 ${tone} ${review?.current ? "ring-4 ring-ink-foreground/45" : ""}`}
              />
            );
          })}
          {/* Đầu phát: chỉ hiện khi hover hoặc kéo */}
          <span
            className="pointer-events-none absolute z-[2] -ml-[7px] h-3.5 w-3.5 scale-0 rounded-full bg-ink-foreground ring-4 ring-brand-600/50 transition-transform duration-150 group-hover:scale-100 group-data-[dragging=true]:scale-100 motion-reduce:transition-none"
            style={{ left: pct(shownTime) }}
          />
          {/* Bong bóng thời gian + tên khái niệm tại vị trí chuột */}
          {hoverPct !== null && hoverTime !== null && (
            <span
              className="pointer-events-none absolute bottom-full z-[3] mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1 text-center text-ink-foreground"
              style={{ left: `${Math.min(94, Math.max(6, hoverPct))}%` }}
            >
              {hoverChapter && (
                <span className="block max-w-[260px] truncate text-[11.5px] font-semibold text-ink-foreground/80">
                  {hoverChapter.name}
                </span>
              )}
              <span className="block font-mono text-xs font-bold">
                {formatTime(hoverTime)}
              </span>
            </span>
          )}
        </div>

        <div className="mt-1.5 flex items-center gap-3.5 text-ink-foreground">
          <button
            type="button"
            onClick={p.onToggle}
            aria-label={isPlaying ? "Tạm dừng" : "Phát"}
            className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-ink-foreground text-brand-600 transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-foreground"
          >
            {isPlaying ? (
              <Pause size={16} className="fill-current" />
            ) : (
              <Play size={16} className="ml-0.5 fill-current" />
            )}
          </button>
          <span className="font-mono text-[13px] font-semibold">
            {formatTime(shownTime)} / {formatTime(duration)}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              aria-pressed={p.captionsOn}
              onClick={p.onToggleCaptions}
              className={`${btn} ${p.captionsOn ? btnOn : btnOff}`}
            >
              <Captions size={15} /> Phụ đề
            </button>
            {!p.compact && (
            <>
            <div className="relative">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
                onBlur={(e) => {
                  if (
                    !e.currentTarget.parentElement?.contains(
                      e.relatedTarget as Node | null,
                    )
                  )
                    setMenuOpen(false);
                }}
                aria-label={`Tốc độ phát ${rate}×`}
                className={`${btn} ${btnOff} font-mono`}
              >
                {rate}×
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  className="absolute bottom-10 right-0 z-30 flex flex-col rounded-xl bg-ink/90 p-1 text-ink-foreground shadow-raised"
                >
                  {PLAYBACK_RATES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      role="menuitemradio"
                      aria-checked={r === rate}
                      onClick={() => {
                        p.onRate(r);
                        setMenuOpen(false);
                      }}
                      className={`rounded-lg px-4 py-1.5 text-left font-mono text-[13px] font-bold transition hover:bg-ink-foreground/15 ${r === rate ? "text-brand-light" : ""}`}
                    >
                      {r}×
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={p.onFullscreen}
              aria-label="Toàn màn hình"
              className={`${btn} ${btnOff} px-2.5`}
            >
              <Maximize size={15} />
            </button>
            </>
            )}
            {!p.hidePanelToggle && (
            <button
              type="button"
              aria-pressed={!p.panelHidden}
              onClick={p.onTogglePanel}
              title="Ẩn/hiện bảng bên (phím B)"
              className={`${btn} ${p.panelHidden ? btnOff : btnOn}`}
            >
              <PanelRight size={15} /> {p.panelHidden ? "Hiện bảng" : "Ẩn bảng"}
            </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/** Nút play tròn to giữa màn: CHỈ hiện khi video tạm dừng, ẩn/hiện đồng bộ với controlsVisible, mờ đi ngay khi phát. */
export function CenterPlay({
  visible,
  isPlaying,
  isBuffering,
}: {
  visible: boolean;
  isPlaying: boolean;
  isBuffering?: boolean;
}) {
  const show = !isPlaying && !isBuffering && visible;
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute left-1/2 top-1/2 z-[15] -translate-x-1/2 -translate-y-1/2 transition-opacity duration-200 motion-reduce:transition-none ${
        show ? "opacity-100" : "opacity-0"
      }`}
    >
      <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-ink/60 text-ink-foreground shadow-raised backdrop-blur-sm transition-transform duration-150 hover:scale-105">
        <Play size={32} className="ml-1 fill-current" />
      </span>
    </div>
  );
}

/** Icon flash giữa màn (scale 0.6→1.1, opacity 0.9→0 trong 500ms) khi bấm phát/dừng: tự biến mất sau 500ms, không đọng lại. */
export function FlashIcon({
  flash,
  onEnd,
}: {
  flash: { key: number; kind: "play" | "pause" } | null;
  onEnd: () => void;
}) {
  if (!flash) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[16] flex items-center justify-center overflow-hidden"
    >
      <span
        key={flash.key}
        onAnimationEnd={onEnd}
        className="yt-flash flex h-16 w-16 items-center justify-center rounded-full bg-ink/60 text-ink-foreground shadow-raised"
      >
        {flash.kind === "play" ? (
          <Play size={26} className="ml-1 fill-current" />
        ) : (
          <Pause size={26} className="fill-current" />
        )}
      </span>
    </div>
  );
}

