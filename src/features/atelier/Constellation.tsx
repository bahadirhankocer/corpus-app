import { useMemo } from 'react';
import type { CSSProperties } from 'react';

import { effectiveProjectId } from '../../db/effective';
import type { Entry, Link, Project } from '../../db/types';
import styles from './Constellation.module.css';

interface Props {
  entries: Entry[];
  links: Link[];
  projects: Project[];
  onOpenEntry: (id: string) => void;
}

interface PlacedNode {
  id: string;
  x: number;
  y: number;
  r: number;
  fresh: boolean;
  drift: { dx: number; dy: number; dur: number; delay: number };
}

interface Cluster {
  id: string;
  label: string;
  x: number;
  y: number;
  labelX: number;
  labelY: number;
}

const GOLDEN_ANGLE = 2.39996;
const MAX_NODES = 90;

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}

/**
 * Deterministic layout: every project is a small cluster, entries spiral outward inside it in
 * the order they were written, so the map grows without ever reshuffling itself.
 */
function layout(entries: Entry[], projects: Project[]): { nodes: PlacedNode[]; clusters: Cluster[] } {
  const chronological = [...entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(-MAX_NODES);
  const groups = new Map<string, Entry[]>();
  for (const e of chronological) {
    const key = effectiveProjectId(e) ?? 'none';
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }

  const keys = [...groups.keys()];
  const clusters: Cluster[] = keys.map((key, i) => {
    const angle = (i / keys.length) * Math.PI * 2 - Math.PI / 2;
    const orbit = keys.length === 1 ? 0 : 25;
    // Labels sit on the outer guide ring, away from the nodes; a lone cluster is labelled below.
    const labelAngle = keys.length === 1 ? Math.PI / 2 : angle;
    return {
      id: key,
      label: projects.find((p) => p.id === key)?.name ?? '',
      x: 50 + Math.cos(angle) * orbit,
      y: 50 + Math.sin(angle) * orbit * 0.92,
      labelX: 50 + Math.cos(labelAngle) * 46,
      labelY: Math.min(97, Math.max(4, 50 + Math.sin(labelAngle) * 47)),
    };
  });

  const newest = chronological.at(-1)?.id;
  const nodes: PlacedNode[] = [];
  for (const cluster of clusters) {
    const list = groups.get(cluster.id) ?? [];
    const phase = hash(cluster.id) * Math.PI * 2;
    list.forEach((entry, j) => {
      const angle = j * GOLDEN_ANGLE + phase;
      const distance = Math.min(4.2 * Math.sqrt(j + 0.6), 21);
      nodes.push({
        id: entry.id,
        x: cluster.x + Math.cos(angle) * distance,
        y: cluster.y + Math.sin(angle) * distance * 0.92,
        r: entry.importance === 3 ? 1.15 : entry.importance === 2 ? 0.8 : 0.55,
        fresh: entry.id === newest,
        drift: {
          dx: (hash(entry.id + 'x') - 0.5) * 1.1,
          dy: (hash(entry.id + 'y') - 0.5) * 1.1,
          dur: 7 + hash(entry.id + 'd') * 7,
          delay: -hash(entry.id + 'l') * 10,
        },
      });
    });
  }
  return { nodes, clusters };
}

/** The AI's living map: every entry a small ring, every accepted or suggested link a hairline. */
export function Constellation({ entries, links, projects, onOpenEntry }: Props) {
  const { nodes, clusters } = useMemo(() => layout(entries, projects), [entries, projects]);
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  return (
    <svg className={styles.svg} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" role="img">
      <g className={styles.guides}>
        {[13, 27, 42].map((r) => (
          <circle key={r} cx="50" cy="50" r={r} />
        ))}
        <line className={styles.scan} x1="50" y1="50" x2="50" y2="8" />
      </g>

      <g>
        {links.map((l) => {
          const a = byId.get(l.fromId);
          const b = byId.get(l.toId);
          if (!a || !b) return null;
          return (
            <line
              key={l.id}
              className={styles.link}
              data-kind={l.kind}
              data-state={l.state}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
            />
          );
        })}
      </g>

      <g>
        {clusters
          .filter((c) => c.label)
          .map((c) => (
            <text key={c.id} className={styles.label} x={c.labelX} y={c.labelY} textAnchor="middle">
              {c.label}
            </text>
          ))}
      </g>

      <g>
        {nodes.map((n) => (
          <g
            key={n.id}
            className={styles.node}
            data-fresh={n.fresh}
            style={
              {
                '--dx': `${n.drift.dx}px`,
                '--dy': `${n.drift.dy}px`,
                '--dur': `${n.drift.dur}s`,
                '--delay': `${n.drift.delay}s`,
              } as CSSProperties
            }
            onClick={() => onOpenEntry(n.id)}
          >
            <circle className={styles.hit} cx={n.x} cy={n.y} r="3" />
            <circle className={styles.dot} cx={n.x} cy={n.y} r={n.r} />
          </g>
        ))}
      </g>
    </svg>
  );
}
