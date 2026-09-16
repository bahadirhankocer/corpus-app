export async function ensurePersistentStorage(): Promise<void> {
  if (!navigator.storage?.persist) return;
  const already = await navigator.storage.persisted?.();
  if (already) return;
  await navigator.storage.persist();
}
