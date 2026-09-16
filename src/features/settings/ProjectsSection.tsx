import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { createProject, deleteProject, updateProject, useProjects } from '../../db/projects';
import { updateSettings } from '../../db/settings';
import type { Project, Settings } from '../../db/types';
import styles from './ProjectsSection.module.css';
import sectionStyles from './SettingsScreen.module.css';

interface FormValues {
  name: string;
  description: string;
  keywords: string;
}

function ProjectForm({
  initial,
  onCancel,
  onSubmit,
}: {
  initial?: Project;
  onCancel: () => void;
  onSubmit: (values: FormValues) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [keywords, setKeywords] = useState(initial?.keywords.join(', ') ?? '');

  return (
    <div className={styles.form}>
      <input
        className={styles.input}
        placeholder={t('settings.projects.nameLabel')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />
      <input
        className={styles.input}
        placeholder={t('settings.projects.descriptionLabel')}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <input
        className={styles.input}
        placeholder={t('settings.projects.keywordsLabel')}
        value={keywords}
        onChange={(e) => setKeywords(e.target.value)}
      />
      <div className={styles.formActions}>
        <button type="button" className={styles.secondaryButton} onClick={onCancel}>
          {t('common.cancel')}
        </button>
        <button
          type="button"
          className={styles.primaryButton}
          disabled={!name.trim()}
          onClick={() => onSubmit({ name, description, keywords })}
        >
          {t('common.save')}
        </button>
      </div>
    </div>
  );
}

interface Props {
  settings: Settings;
}

export function ProjectsSection({ settings }: Props) {
  const { t } = useTranslation();
  const projects = useProjects();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  function parseKeywords(raw: string): string[] {
    return raw
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
  }

  async function handleCreate(values: FormValues) {
    await createProject({
      name: values.name.trim(),
      description: values.description.trim(),
      keywords: parseKeywords(values.keywords),
    });
    setAdding(false);
  }

  async function handleUpdate(id: string, values: FormValues) {
    await updateProject(id, {
      name: values.name.trim(),
      description: values.description.trim(),
      keywords: parseKeywords(values.keywords),
    });
    setEditingId(null);
  }

  async function handleDelete(id: string) {
    await deleteProject(id);
    if (settings.activeProjectId === id) {
      await updateSettings({ activeProjectId: undefined });
    }
  }

  async function handleActiveProject(id: string) {
    await updateSettings({ activeProjectId: id || undefined });
  }

  return (
    <div className={sectionStyles.section}>
      <span className={sectionStyles.sectionTitle}>{t('settings.projects.title')}</span>

      {projects && projects.length > 0 && (
        <select
          className={styles.select}
          value={settings.activeProjectId ?? ''}
          onChange={(e) => handleActiveProject(e.target.value)}
        >
          <option value="">{t('settings.projects.noActiveProject')}</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}

      <div className={styles.list}>
        {projects?.map((project) =>
          editingId === project.id ? (
            <ProjectForm
              key={project.id}
              initial={project}
              onCancel={() => setEditingId(null)}
              onSubmit={(values) => handleUpdate(project.id, values)}
            />
          ) : (
            <div key={project.id} className={styles.card}>
              <div className={styles.cardTop}>
                <span className={styles.name}>{project.name}</span>
                <div className={styles.rowActions}>
                  <button type="button" className={styles.linkButton} onClick={() => setEditingId(project.id)}>
                    {t('common.edit')}
                  </button>
                  <button type="button" className={styles.linkButton} onClick={() => handleDelete(project.id)}>
                    {t('common.delete')}
                  </button>
                </div>
              </div>
              {project.description && <span className={styles.desc}>{project.description}</span>}
              {project.keywords.length > 0 && (
                <span className={styles.keywords}>{project.keywords.join(' · ')}</span>
              )}
            </div>
          ),
        )}
      </div>

      {adding ? (
        <ProjectForm onCancel={() => setAdding(false)} onSubmit={handleCreate} />
      ) : (
        <button type="button" className={styles.addButton} onClick={() => setAdding(true)}>
          {t('settings.projects.add')}
        </button>
      )}
    </div>
  );
}
