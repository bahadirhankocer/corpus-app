import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuid } from 'uuid';

import { db } from './db';
import type { Project } from './types';

export interface NewProjectInput {
  name: string;
  description: string;
  keywords: string[];
}

export async function createProject(input: NewProjectInput): Promise<Project> {
  const project: Project = {
    id: uuid(),
    name: input.name,
    description: input.description,
    keywords: input.keywords,
    status: 'active',
  };
  await db.projects.add(project);
  return project;
}

export async function updateProject(
  id: string,
  patch: Partial<NewProjectInput & Pick<Project, 'status' | 'manifesto' | 'procedure' | 'compendium' | 'compendiumUpdatedAt'>>,
): Promise<void> {
  await db.projects.update(id, patch);
}

export async function deleteProject(id: string): Promise<void> {
  await db.projects.delete(id);
}

export function useProjects(): Project[] | undefined {
  return useLiveQuery(() => db.projects.toArray(), []);
}

export function useActiveProjects(): Project[] | undefined {
  return useLiveQuery(() => db.projects.where('status').equals('active').toArray(), []);
}
