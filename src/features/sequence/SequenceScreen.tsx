import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { draftSequence } from '../../ai/sequence';
import { ALL_CATEGORIES, CATEGORY_CODES } from '../../constants/categories';
import { effectiveCategories } from '../../db/effective';
import { useEntriesForProject } from '../../db/entries';
import { useProjects } from '../../db/projects';
import { createSequenceVersion, updateSequenceSections, useSequenceVersions } from '../../db/sequences';
import { useSettings } from '../../db/settings';
import type { Category, Entry, Sequence } from '../../db/types';
import { StyleGuidePrint } from '../export/StyleGuidePrint';
import { exportVoiceoverScript } from '../export/voiceoverExport';
import styles from './SequenceScreen.module.css';

type Section = Sequence['sections'][number];

function entryPreview(entry: Entry): string {
  return entry.title || entry.text || entry.transcript || entry.ai.summary || '';
}

function EntryCard({ entry, onOpen }: { entry: Entry; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entry.id });
  const cats = effectiveCategories(entry)
    .map((c) => CATEGORY_CODES[c])
    .join(' ');

  return (
    <div
      ref={setNodeRef}
      className={styles.card}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      onClick={onOpen}
      {...attributes}
      {...listeners}
    >
      {cats && <span className={styles.cardMeta}>{cats}</span>}
      <span className={styles.cardText}>{entryPreview(entry)}</span>
    </div>
  );
}

function SectionColumn({
  section,
  entries,
  onRename,
  onRemove,
  onOpenEntry,
}: {
  section: Section;
  entries: Entry[];
  onRename: (label: string) => void;
  onRemove: () => void;
  onOpenEntry: (id: string) => void;
}) {
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({ id: section.id });
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <input
          className={styles.sectionLabel}
          value={section.label}
          onChange={(e) => onRename(e.target.value)}
        />
        <button type="button" className={styles.sectionRemove} onClick={onRemove}>
          {t('sequence.removeSection')}
        </button>
      </div>
      <SortableContext items={section.entryIds} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className={styles.sectionBody} data-over={isOver}>
          {entries.map((entry) => (
            <EntryCard key={entry.id} entry={entry} onOpen={() => onOpenEntry(entry.id)} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

interface Props {
  onOpenEntry: (id: string) => void;
}

export function SequenceScreen({ onOpenEntry }: Props) {
  const { t } = useTranslation();
  const projects = useProjects();
  const settings = useSettings();
  const [projectId, setProjectId] = useState('');
  const [generating, setGenerating] = useState(false);
  const [showStyleGuide, setShowStyleGuide] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [sections, setSections] = useState<Section[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [versionIndex, setVersionIndex] = useState(0);

  useEffect(() => {
    if (projectId || !projects || projects.length === 0) return;
    setProjectId(settings?.activeProjectId && projects.some((p) => p.id === settings.activeProjectId)
      ? settings.activeProjectId
      : projects[0].id);
  }, [projects, settings, projectId]);

  const entries = useEntriesForProject(projectId || undefined);
  const versions = useSequenceVersions(projectId || undefined);
  const current = versions?.[versionIndex];

  useEffect(() => {
    setVersionIndex(0);
  }, [projectId, versions?.length]);

  useEffect(() => {
    setSections(current?.sections ?? []);
  }, [current?.id]);

  const entryMap = useMemo(() => {
    const map = new Map<string, Entry>();
    entries?.forEach((e) => map.set(e.id, e));
    return map;
  }, [entries]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function findSectionIndex(itemId: string): number {
    return sections.findIndex((s) => s.entryIds.includes(itemId));
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const fromIndex = findSectionIndex(activeId);
    let toIndex = findSectionIndex(overId);
    if (toIndex === -1) {
      toIndex = sections.findIndex((s) => s.id === overId);
    }
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

    setSections((prev) => {
      const next = prev.map((s) => ({ ...s, entryIds: [...s.entryIds] }));
      const itemIdx = next[fromIndex].entryIds.indexOf(activeId);
      next[fromIndex].entryIds.splice(itemIdx, 1);
      const overItemIdx = next[toIndex].entryIds.indexOf(overId);
      next[toIndex].entryIds.splice(overItemIdx === -1 ? next[toIndex].entryIds.length : overItemIdx, 0, activeId);
      return next;
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const sectionIndex = findSectionIndex(activeId);
    if (sectionIndex === -1) return;

    if (activeId !== overId) {
      const overIndexInSection = sections[sectionIndex].entryIds.indexOf(overId);
      if (overIndexInSection !== -1) {
        setSections((prev) => {
          const next = prev.map((s) => ({ ...s, entryIds: [...s.entryIds] }));
          const from = next[sectionIndex].entryIds.indexOf(activeId);
          const to = next[sectionIndex].entryIds.indexOf(overId);
          next[sectionIndex].entryIds = arrayMove(next[sectionIndex].entryIds, from, to);
          return next;
        });
      }
    }

    if (current) void updateSequenceSections(current.id, sections);
  }

  async function handleGenerate() {
    if (!projectId || !entries || entries.length === 0 || !settings?.geminiApiKey) return;
    setGenerating(true);
    try {
      const draft = await draftSequence(entries, settings.geminiApiKey, settings.model);
      const withIds = draft.map((s) => ({ id: crypto.randomUUID(), label: s.label, entryIds: s.entryIds }));
      const placed = new Set(withIds.flatMap((s) => s.entryIds));
      const unplaced = entries.filter((e) => !placed.has(e.id)).map((e) => e.id);
      if (unplaced.length > 0) {
        withIds.push({ id: crypto.randomUUID(), label: t('sequence.unplaced'), entryIds: unplaced });
      }
      await createSequenceVersion(projectId, withIds, 'ai');
      setVersionIndex(0);
    } finally {
      setGenerating(false);
    }
  }

  async function handleAddSection() {
    const newSection: Section = { id: crypto.randomUUID(), label: t('sequence.newSection'), entryIds: [] };
    if (!current) {
      if (!projectId || !entries) return;
      const unplaced: Section = {
        id: crypto.randomUUID(),
        label: t('sequence.unplaced'),
        entryIds: entries.map((e) => e.id),
      };
      const seq = await createSequenceVersion(projectId, [unplaced, newSection], 'user');
      setVersionIndex(0);
      setSections(seq.sections);
      return;
    }
    setSections((prev) => [...prev, newSection]);
  }

  function handleRenameSection(id: string, label: string) {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, label } : s)));
  }

  function handleRemoveSection(id: string) {
    setSections((prev) => {
      const section = prev.find((s) => s.id === id);
      const rest = prev.filter((s) => s.id !== id);
      if (!section || section.entryIds.length === 0) return rest;
      if (rest.length === 0) return prev;
      const next = rest.map((s) => ({ ...s, entryIds: [...s.entryIds] }));
      next[0].entryIds = [...section.entryIds, ...next[0].entryIds];
      return next;
    });
  }

  useEffect(() => {
    if (!current) return;
    const timeout = window.setTimeout(() => void updateSequenceSections(current.id, sections), 400);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections]);

  const activeEntry = activeId ? entryMap.get(activeId) : undefined;
  const activeProject = projects?.find((p) => p.id === projectId);

  const styleGuideGroups = useMemo(() => {
    if (!entries) return [];
    return ALL_CATEGORIES.map((cat: Category) => ({
      category: cat,
      lines: entries.filter((e) => effectiveCategories(e).includes(cat)).map((e) => entryPreview(e)),
    })).filter((g) => g.lines.length > 0);
  }, [entries]);

  return (
    <div className={styles.screen}>
      <div className={styles.controls}>
        <div className={styles.controlsRow}>
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
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.actionButton}
              disabled={generating || !entries?.length || !settings?.geminiApiKey}
              onClick={handleGenerate}
            >
              {generating ? t('sequence.generating') : t('sequence.generate')}
            </button>
          </div>
        </div>

        {versions && versions.length > 0 && (
          <div className={styles.versionRow}>
            <button
              type="button"
              className={styles.versionButton}
              disabled={versionIndex >= versions.length - 1}
              onClick={() => setVersionIndex((i) => Math.min(i + 1, versions.length - 1))}
            >
              ←
            </button>
            <span>
              v{current?.version} · {current?.source === 'ai' ? t('sequence.sourceAi') : t('sequence.sourceUser')}
            </span>
            <button
              type="button"
              className={styles.versionButton}
              disabled={versionIndex <= 0}
              onClick={() => setVersionIndex((i) => Math.max(i - 1, 0))}
            >
              →
            </button>
          </div>
        )}

        {styleGuideGroups.length > 0 && (
          <button type="button" className={styles.styleGuideToggle} onClick={() => setShowStyleGuide((v) => !v)}>
            {showStyleGuide ? t('sequence.hideStyleGuide') : t('sequence.showStyleGuide')}
          </button>
        )}

        {entries && entries.length > 0 && activeProject && (
          <div className={styles.actions}>
            <button type="button" className={styles.actionButton} onClick={() => setShowPrint(true)}>
              {t('sequence.exportPdf')}
            </button>
            <button
              type="button"
              className={styles.actionButton}
              onClick={() => exportVoiceoverScript(activeProject, entries, current)}
            >
              {t('sequence.exportVoiceover')}
            </button>
          </div>
        )}
      </div>

      {showPrint && activeProject && entries && (
        <StyleGuidePrint
          project={activeProject}
          entries={entries}
          sequence={current}
          onClose={() => setShowPrint(false)}
        />
      )}

      {showStyleGuide && (
        <div className={styles.styleGuidePanel}>
          {styleGuideGroups.map((g) => (
            <div key={g.category} className={styles.styleGuideGroup}>
              <span className={styles.styleGuideTitle}>{t(`category.${g.category}`)}</span>
              {g.lines.map((line, i) => (
                <span key={i} className={styles.styleGuideLine}>
                  {line}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}

      {(!entries || entries.length === 0) && <div className={styles.empty}>{t('map.empty')}</div>}

      {entries && entries.length > 0 && sections.length === 0 && (
        <div className={styles.empty}>{t('sequence.empty')}</div>
      )}

      {entries && entries.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className={styles.sections}>
            {sections.map((section) => (
              <SectionColumn
                key={section.id}
                section={section}
                entries={section.entryIds.map((id) => entryMap.get(id)).filter((e): e is Entry => !!e)}
                onRename={(label) => handleRenameSection(section.id, label)}
                onRemove={() => handleRemoveSection(section.id)}
                onOpenEntry={onOpenEntry}
              />
            ))}
            <button type="button" className={styles.addSection} onClick={handleAddSection}>
              {t('sequence.addSection')}
            </button>
          </div>
          <DragOverlay>{activeEntry ? <EntryCard entry={activeEntry} onOpen={() => {}} /> : null}</DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
