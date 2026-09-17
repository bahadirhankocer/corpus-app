import type { Core, EdgeSingular, NodeSingular } from 'cytoscape';
import { useEffect, useMemo, useState } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import { useTranslation } from 'react-i18next';

import { CategoryChips } from '../../components/CategoryChips';
import { effectiveCategories } from '../../db/effective';
import { useEntriesForProject } from '../../db/entries';
import { setLinkState, useLinksForEntries } from '../../db/links';
import { useProjects } from '../../db/projects';
import { useSettings } from '../../db/settings';
import type { Category, Link } from '../../db/types';
import styles from './MapScreen.module.css';

interface Props {
  onOpenEntry: (id: string) => void;
}

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function MapScreen({ onOpenEntry }: Props) {
  const { t } = useTranslation();
  const projects = useProjects();
  const settings = useSettings();
  const [projectId, setProjectId] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<Category[]>([]);
  const [selectedLink, setSelectedLink] = useState<Link | null>(null);

  useEffect(() => {
    if (projectId || !projects || projects.length === 0) return;
    setProjectId(settings?.activeProjectId && projects.some((p) => p.id === settings.activeProjectId)
      ? settings.activeProjectId
      : projects[0].id);
  }, [projects, settings, projectId]);

  const entries = useEntriesForProject(projectId || undefined);
  const filteredEntries = useMemo(
    () =>
      categoryFilter.length === 0
        ? entries
        : entries?.filter((e) => effectiveCategories(e).some((c) => categoryFilter.includes(c))),
    [entries, categoryFilter],
  );
  const entryIds = useMemo(() => filteredEntries?.map((e) => e.id) ?? [], [filteredEntries]);
  const links = useLinksForEntries(entryIds);

  const elements = useMemo(() => {
    const nodes = (filteredEntries ?? []).map((e) => ({
      data: {
        id: e.id,
        label: (e.title || e.text || e.transcript || e.ai.summary || '').slice(0, 40),
      },
    }));
    const edges = (links ?? []).map((l) => ({
      data: { id: l.id, source: l.fromId, target: l.toId, kind: l.kind, state: l.state },
    }));
    return [...nodes, ...edges];
  }, [filteredEntries, links]);

  const stylesheet = useMemo(() => {
    const text = cssVar('--color-text') || '#111';
    const muted = cssVar('--color-text-muted') || '#777';
    const border = cssVar('--color-border') || '#ddd';
    const surface = cssVar('--color-surface') || '#fff';
    const warning = cssVar('--color-warning') || '#b8663f';
    const fontFamily = cssVar('--font-sans') || 'sans-serif';

    return [
      {
        selector: 'node',
        style: {
          'background-color': surface,
          'border-width': 1,
          'border-color': border,
          label: 'data(label)',
          color: text,
          'font-family': fontFamily,
          'font-size': 10,
          'text-valign': 'center',
          'text-halign': 'center',
          'text-wrap': 'wrap',
          'text-max-width': '80px',
          width: 90,
          height: 90,
          shape: 'ellipse',
        },
      },
      {
        selector: 'edge[kind = "connection"]',
        style: {
          'line-style': 'solid',
          'line-color': muted,
          width: 1.5,
          'curve-style': 'bezier',
          'target-arrow-shape': 'none',
        },
      },
      {
        selector: 'edge[kind = "contradiction"]',
        style: {
          'line-style': 'dashed',
          'line-color': warning,
          width: 1.5,
          'curve-style': 'bezier',
          'target-arrow-shape': 'none',
        },
      },
      {
        selector: 'edge[state = "suggested"]',
        style: { opacity: 0.4 },
      },
      {
        selector: 'edge[state = "accepted"]',
        style: { opacity: 1 },
      },
    ];
  }, [settings?.theme]);

  function bindEvents(cy: Core) {
    cy.removeAllListeners();
    cy.on('tap', 'node', (evt) => {
      const node = evt.target as NodeSingular;
      onOpenEntry(node.id());
    });
    cy.on('tap', 'edge', (evt) => {
      const edge = evt.target as EdgeSingular;
      const link = (links ?? []).find((l) => l.id === edge.id());
      if (link) setSelectedLink(link);
    });
  }

  async function handleAccept() {
    if (!selectedLink) return;
    await setLinkState(selectedLink.id, 'accepted');
    setSelectedLink(null);
  }

  async function handleDismiss() {
    if (!selectedLink) return;
    await setLinkState(selectedLink.id, 'dismissed');
    setSelectedLink(null);
  }

  return (
    <div className={styles.screen}>
      <div className={styles.controls}>
        {projects && projects.length > 0 ? (
          <select className={styles.select} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        ) : (
          <span className={styles.select}>{t('map.noProjects')}</span>
        )}
        <CategoryChips value={categoryFilter} onChange={setCategoryFilter} />
      </div>

      <div className={styles.wrapper}>
        {filteredEntries && filteredEntries.length === 0 && (
          <div className={styles.empty}>{t('map.empty')}</div>
        )}
        {filteredEntries && filteredEntries.length > 0 && (
          <CytoscapeComponent
            key={settings?.theme}
            elements={elements}
            stylesheet={stylesheet as never}
            style={{ width: '100%', height: '100%' }}
            className={styles.canvas}
            layout={{ name: 'cose', animate: false } as never}
            cy={bindEvents}
          />
        )}

        {selectedLink && (
          <div className={styles.rationalePanel}>
            <p className={styles.rationaleText}>{selectedLink.rationale}</p>
            <div className={styles.rationaleActions}>
              <button type="button" className={styles.dismissButton} onClick={handleDismiss}>
                {t('map.reject')}
              </button>
              {selectedLink.state === 'suggested' && (
                <button type="button" className={styles.acceptButton} onClick={handleAccept}>
                  {t('map.accept')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
