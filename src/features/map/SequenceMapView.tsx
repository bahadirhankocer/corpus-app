import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';

import { MAP_COLS, MAP_ROWS } from '../../ai/map';
import type { Entry, Lang, Link, SequenceMap } from '../../db/types';
import { entryHeadline, upper } from '../../i18n/localize';
import styles from './SequenceMapView.module.css';

interface Props {
  map: SequenceMap;
  entries: Entry[];
  links: Link[];
  lang: Lang;
  freshLabel: string;
  onOpenEntry: (id: string) => void;
  /** increments when the view should fit everything again */
  fitSignal: number;
}

const CELL_W = 380;
/** a row is as tall as its tallest stack, and never shorter than this */
const ROW_MIN = 280;
const ROW_GAP = 130;
const PAD = 160;
const MIN_K = 0.12;
/** below this zoom a tap opens the cluster instead of the tiny headline under the finger */
const READ_K = 0.42;
const MAX_K = 3.2;
const INDENTS = [0, 26, 10, 44, 18, 34];

interface PlacedLine {
  id: string;
  text: string;
  x: number;
  y: number;
  size: number;
  kind: 'major' | 'mid' | 'minor';
  fresh: boolean;
}

interface PlacedCluster {
  index: number;
  number: string;
  name: string;
  ax: number;
  ay: number;
  lines: PlacedLine[];
  bottom: number;
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}

/** Headlines stack under their matrix point in the order they were written, sized by importance. */
function stack(ids: string[], byId: Map<string, Entry>, text: (id: string) => string, newest?: string) {
  const lines: PlacedLine[] = [];
  let y = 30;
  const ordered = ids
    .map((id) => byId.get(id))
    .filter((e): e is Entry => Boolean(e))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  ordered.forEach((entry, i) => {
    const label = text(entry.id);
    const long = label.length > 18 ? 0.78 : label.length > 12 ? 0.9 : 1;
    const kind = entry.importance === 3 ? 'major' : entry.importance === 2 ? 'mid' : 'minor';
    const size = (kind === 'major' ? 34 : kind === 'mid' ? 23 : 15) * (kind === 'minor' ? 1 : long);
    const indent = INDENTS[Math.floor(hash(entry.id) * INDENTS.length)] * (i === 0 ? 0 : 1);
    y += size * (kind === 'minor' ? 1.3 : 0.98);
    lines.push({ id: entry.id, text: label, x: 16 + indent, y, size, kind, fresh: entry.id === newest });
    y += kind === 'minor' ? 3 : 6;
  });
  return { lines, height: y };
}

function layout(map: SequenceMap, entries: Entry[], lang: Lang) {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const newest = [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.id;
  const text = (id: string) =>
    map.headlines[id]?.[lang] || upper(entryHeadline(byId.get(id)!, lang).split(/\s+/).slice(0, 4).join(' '));

  const cells = map.clusters.map((c, index) => ({
    index,
    number: String(index + 1).padStart(2, '0'),
    name: c.name[lang],
    col: c.col,
    row: c.row,
    ...stack(c.entryIds, byId, text, newest),
  }));

  // Entries written after the map was drawn wait at the next free point until the next redraw.
  const placed = new Set(map.clusters.flatMap((c) => c.entryIds));
  const fresh = entries.filter((e) => !placed.has(e.id)).map((e) => e.id);
  if (fresh.length > 0) {
    const taken = new Set(map.clusters.map((c) => `${c.col},${c.row}`));
    let spot = { col: MAP_COLS - 1, row: MAP_ROWS - 1 };
    search: for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        if (!taken.has(`${col},${row}`)) {
          spot = { col, row };
          break search;
        }
      }
    }
    cells.push({ index: -1, number: '··', name: '', ...spot, ...stack(fresh, byId, text, newest) });
  }

  // The matrix keeps its columns, and each row grows to fit what hangs from it.
  const rowY: number[] = [PAD];
  for (let row = 0; row < MAP_ROWS; row++) {
    const tallest = Math.max(0, ...cells.filter((c) => c.row === row).map((c) => c.height));
    rowY.push(rowY[row] + Math.max(ROW_MIN, tallest + ROW_GAP));
  }
  const anchor = (col: number, row: number) => ({ ax: PAD + col * CELL_W, ay: rowY[row] });

  const all: PlacedCluster[] = cells.map((c) => {
    const { ax, ay } = anchor(c.col, c.row);
    return {
      index: c.index,
      number: c.number,
      name: c.name,
      ax,
      ay,
      lines: c.lines.map((l) => ({ ...l, x: ax + l.x, y: ay + l.y })),
      bottom: ay + c.height,
    };
  });
  const clusters = all.filter((c) => c.index >= 0);
  const pending = all.find((c) => c.index < 0);

  const lineOf = new Map<string, PlacedLine & { cluster: number }>();
  for (const c of all) {
    for (const l of c.lines) lineOf.set(l.id, { ...l, cluster: c.index });
  }

  const points: { ax: number; ay: number; col: number; row: number }[] = [];
  for (let col = 0; col < MAP_COLS; col++) {
    for (let row = 0; row < MAP_ROWS; row++) points.push({ ...anchor(col, row), col, row });
  }
  const size = { width: PAD * 2 + (MAP_COLS - 1) * CELL_W + 340, height: rowY[MAP_ROWS - 1] + 520 };
  return { clusters, pending, lineOf, points, rowY, size };
}

/** A hand-drawn looking curve: it always bends, to a side and depth fixed by its key. */
function organic(x1: number, y1: number, x2: number, y2: number, key: string, depth = 0.32): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy) || 1;
  const side = hash(key) > 0.5 ? 1 : -1;
  const bend = length * depth * (0.45 + hash(`${key}b`) * 0.55) * side;
  const nx = -dy / length;
  const ny = dx / length;
  const c1x = x1 + dx * 0.28 + nx * bend;
  const c1y = y1 + dy * 0.28 + ny * bend;
  const c2x = x1 + dx * 0.72 + nx * bend * 0.6;
  const c2y = y1 + dy * 0.72 + ny * bend * 0.6;
  return `M${x1.toFixed(1)},${y1.toFixed(1)} C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
}

/** Two headlines in the same stack are tied by an arc in the margin, like a bracket drawn by hand. */
function marginArc(a: PlacedLine, b: PlacedLine): string {
  const x = Math.min(a.x, b.x) - 8;
  const ya = a.y - a.size * 0.35;
  const yb = b.y - b.size * 0.35;
  const reach = 14 + Math.abs(yb - ya) * 0.22;
  return `M${a.x - 6},${ya} C${x - reach},${ya} ${x - reach},${yb} ${b.x - 6},${yb}`;
}

/**
 * The map as a sequence map: numbered clusters on a matrix, each a stack of uppercase headlines, tied
 * together by organic lines. Pinch or scroll to zoom, drag to move, tap a headline to open it.
 */
export function SequenceMapView({ map, entries, links, lang, freshLabel, onOpenEntry, fitSignal }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const view = useRef({ x: 0, y: 0, k: 0.5 });
  const touched = useRef(false);
  const openRef = useRef(onOpenEntry);
  useEffect(() => {
    openRef.current = onOpenEntry;
  }, [onOpenEntry]);

  const { clusters, pending, lineOf, points, rowY, size } = useMemo(() => layout(map, entries, lang), [map, entries, lang]);

  const bounds = useMemo(() => {
    const all = pending ? [...clusters, pending] : clusters;
    const minX = Math.min(...all.map((c) => c.ax)) - 90;
    const minY = Math.min(...all.map((c) => c.ay)) - 90;
    const maxX = Math.max(...all.map((c) => c.ax)) + 360;
    const maxY = Math.max(...all.map((c) => c.bottom)) + 50;
    return { minX, minY, maxX, maxY };
  }, [clusters, pending]);

  const entryLinks = useMemo(
    () =>
      links
        .filter((l) => l.state !== 'dismissed')
        .map((l) => ({ link: l, a: lineOf.get(l.fromId), b: lineOf.get(l.toId) }))
        .filter((x): x is { link: Link; a: PlacedLine & { cluster: number }; b: PlacedLine & { cluster: number } } =>
          Boolean(x.a && x.b),
        ),
    [links, lineOf],
  );

  // --- viewport -------------------------------------------------------------------------------------

  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;

  function apply(animate = false) {
    const world = worldRef.current;
    if (!world) return;
    const { x, y, k } = view.current;
    world.style.transition = animate ? 'transform 0.7s cubic-bezier(0.16, 1, 0.3, 1)' : 'none';
    world.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${k})`;
    world.style.setProperty('--k', k.toFixed(3));
  }

  /**
   * Frames a box. `loose` lets a wide matrix run past the right edge of a narrow screen, so it opens at a
   * readable size from 01 onwards instead of as a thin strip.
   */
  function fitTo(box: { minX: number; minY: number; maxX: number; maxY: number }, animate: boolean, maxK = 1.2, loose = false) {
    const el = containerRef.current;
    if (!el) return;
    const cw = el.clientWidth;
    const ch = el.clientHeight;
    const bw = box.maxX - box.minX;
    const bh = box.maxY - box.minY;
    const fit = Math.min(cw / bw, ch / bh);
    const k = Math.min(maxK, Math.max(MIN_K, loose ? Math.min(ch / bh, fit * 1.5) : fit));
    view.current = {
      k,
      x: bw * k > cw ? -box.minX * k : (cw - bw * k) / 2 - box.minX * k,
      y: (ch - bh * k) / 2 - box.minY * k,
    };
    apply(animate);
  }

  useLayoutEffect(() => {
    touched.current = false;
    // the first look is loose; the fit button shows everything
    fitTo(boundsRef.current, fitSignal > 0, 1.2, fitSignal === 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map.id, fitSignal]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (!touched.current) fitTo(boundsRef.current, false, 1.2, true);
    });
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const pointers = new Map<number, { x: number; y: number }>();
    let origin = { x: 0, y: 0 };
    let moved = false;
    let pinch: { dist: number; mid: { x: number; y: number }; start: { x: number; y: number; k: number } } | null = null;

    const local = (e: { clientX: number; clientY: number }) => {
      const rect = el.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    function zoomAt(point: { x: number; y: number }, k: number, animate = false) {
      const v = view.current;
      const next = Math.min(MAX_K, Math.max(MIN_K, k));
      const wx = (point.x - v.x) / v.k;
      const wy = (point.y - v.y) / v.k;
      view.current = { k: next, x: point.x - wx * next, y: point.y - wy * next };
      touched.current = true;
      apply(animate);
    }

    function pinchState() {
      const [a, b] = [...pointers.values()];
      return {
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      };
    }

    function onDown(e: PointerEvent) {
      el!.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, local(e));
      if (pointers.size === 1) {
        origin = local(e);
        moved = false;
      }
      if (pointers.size === 2) {
        pinch = { ...pinchState(), start: { ...view.current } };
        moved = true;
      }
    }

    function onMove(e: PointerEvent) {
      const previous = pointers.get(e.pointerId);
      if (!previous) return;
      const point = local(e);
      pointers.set(e.pointerId, point);
      if (pointers.size >= 2 && pinch) {
        const now = pinchState();
        const k = Math.min(MAX_K, Math.max(MIN_K, pinch.start.k * (now.dist / pinch.dist)));
        const wx = (pinch.mid.x - pinch.start.x) / pinch.start.k;
        const wy = (pinch.mid.y - pinch.start.y) / pinch.start.k;
        view.current = { k, x: now.mid.x - wx * k, y: now.mid.y - wy * k };
      } else {
        view.current.x += point.x - previous.x;
        view.current.y += point.y - previous.y;
        if (Math.hypot(point.x - origin.x, point.y - origin.y) > 6) moved = true;
      }
      touched.current = true;
      apply();
    }

    function onUp(e: PointerEvent) {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (pointers.size === 0 && !moved && e.type === 'pointerup') tap(e);
    }

    function tap(e: PointerEvent) {
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const entry = target?.closest<SVGElement>('[data-entry]')?.dataset.entry;
      if (entry && view.current.k >= READ_K) {
        openRef.current(entry);
        return;
      }
      const box = target?.closest<SVGElement>('[data-box]')?.dataset.box;
      if (box) {
        touched.current = true;
        fitTo(JSON.parse(box) as { minX: number; minY: number; maxX: number; maxY: number }, true, 1.4);
      }
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      zoomAt(local(e), view.current.k * Math.exp(-e.deltaY * 0.0015));
    }

    function onDouble(e: MouseEvent) {
      zoomAt(local(e), view.current.k * 1.9, true);
    }

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('dblclick', onDouble);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('dblclick', onDouble);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- drawing --------------------------------------------------------------------------------------


  let drawIndex = 0;
  const delay = () => ({ '--delay': `${0.25 + drawIndex++ * 0.07}s` }) as CSSProperties;

  return (
    <div className={styles.viewport} ref={containerRef}>
      <div className={styles.world} ref={worldRef} style={{ width: size.width, height: size.height }}>
        <svg className={styles.svg} width={size.width} height={size.height} viewBox={`0 0 ${size.width} ${size.height}`}>
          <g className={styles.grid}>
            {points.map((p) => (
              <path
                key={`${p.col},${p.row}`}
                d={`M${p.ax - 6},${p.ay} H${p.ax + 6} M${p.ax},${p.ay - 6} V${p.ay + 6}`}
              />
            ))}
            {Array.from({ length: MAP_COLS }, (_, col) => (
              <text key={`c${col}`} className={styles.axis} x={PAD + col * CELL_W} y={PAD - 96} textAnchor="middle">
                {String.fromCharCode(65 + col)}
              </text>
            ))}
            {Array.from({ length: MAP_ROWS }, (_, row) => (
              <text key={`r${row}`} className={styles.axis} x={PAD - 96} y={rowY[row] + 3} textAnchor="middle">
                {row + 1}
              </text>
            ))}
          </g>

          <g className={styles.bonds}>
            {map.bonds.map((b, i) => {
              const from = clusters[b.from];
              const to = clusters[b.to];
              if (!from || !to) return null;
              const id = `bond-${map.id}-${i}`;
              const d = organic(from.ax, from.ay, to.ax, to.ay, `${b.from}-${b.to}`, 0.22);
              return (
                <g key={id}>
                  <path id={id} className={styles.bond} d={d} pathLength={1} style={delay()} />
                  <text className={styles.why} dy={-5}>
                    <textPath href={`#${id}`} startOffset="50%" textAnchor="middle">
                      {upper(b.why[lang])}
                    </textPath>
                  </text>
                </g>
              );
            })}
          </g>

          <g className={styles.links}>
            {entryLinks.map(({ link, a, b }) => {
              const same = a.cluster === b.cluster;
              const d = same
                ? marginArc(a.y < b.y ? a : b, a.y < b.y ? b : a)
                : organic(a.x - 6, a.y - a.size * 0.35, b.x - 6, b.y - b.size * 0.35, link.id);
              return (
                <path
                  key={link.id}
                  className={styles.link}
                  data-kind={link.kind}
                  data-same={same}
                  d={d}
                  pathLength={1}
                  style={delay()}
                />
              );
            })}
          </g>

          {(pending ? [...clusters, pending] : clusters).map((c) => {
            const box = { minX: c.ax - 60, minY: c.ay - 70, maxX: c.ax + 340, maxY: c.bottom + 30 };
            return (
              <g key={c.number} className={styles.cluster} data-pending={c.index < 0} data-box={JSON.stringify(box)}>
                <circle className={styles.point} cx={c.ax} cy={c.ay} r={c.index < 0 ? 3 : 4.5} />
                <g className={styles.head}>
                  <rect x={c.ax - 20} y={c.ay - 60} width={320} height={56} className={styles.hit} />
                  <text className={styles.name} x={c.ax + 16} y={c.ay - 12}>
                    <tspan className={styles.number}>{c.number}</tspan>
                    <tspan dx="0.55em">{c.index < 0 ? freshLabel : c.name}</tspan>
                  </text>
                </g>
                {c.lines.map((l) => (
                  <text
                    key={l.id}
                    data-entry={l.id}
                    className={styles.headline}
                    data-kind={l.kind}
                    data-fresh={l.fresh}
                    x={l.x}
                    y={l.y}
                    style={{ fontSize: l.size }}
                  >
                    {l.text}
                  </text>
                ))}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
