import { APP_CONSTANTS } from "@/lib/constants";
import { buildBackupZip } from "./export";
import { BackupError, openBackupZip, readManifest } from "./manifest";
import { supabase } from "@/lib/supabase";

export interface SnapshotInfo {
  id: string;
  exportedAt: string;
  appVersion: string;
  counts: Record<string, number>;
  sizeBytes: number;
}

// Anchored, and deliberately narrow: the only names this accepts are ones
// writeSnapshot produced. A traversal segment cannot match it.
const SNAPSHOT_ID = /^pre-import-[0-9TZ.:-]+\.zip$/;

function assertSupabase() {
  if (!supabase) {
    throw new BackupError("Supabase Storage is not configured.");
  }
}

export async function writeSnapshot(
  userId: string,
  email: string,
): Promise<string> {
  assertSupabase();
  const { buffer } = await buildBackupZip(userId, email);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const targetId = `pre-import-${stamp}.zip`;
  const storagePath = `${userId}/${targetId}`;

  const { error } = await supabase!.storage
    .from("backups")
    .upload(storagePath, buffer, {
      contentType: "application/zip",
      upsert: true,
    });

  if (error) {
    throw new BackupError(`Failed to save backup snapshot: ${error.message}`);
  }

  await pruneSnapshots(userId, APP_CONSTANTS.BACKUP_SNAPSHOT_KEEP);
  return targetId; // Return just the ID, matching old API behavior
}

export async function listSnapshots(userId: string): Promise<SnapshotInfo[]> {
  assertSupabase();
  const { data, error } = await supabase!.storage.from("backups").list(userId);

  if (error || !data) {
    return [];
  }

  const infos: SnapshotInfo[] = [];
  for (const file of data) {
    if (!SNAPSHOT_ID.test(file.name)) continue;

    try {
      const { data: fileData, error: downloadError } = await supabase!.storage
        .from("backups")
        .download(`${userId}/${file.name}`);

      if (downloadError || !fileData) continue;
      
      const buffer = Buffer.from(await fileData.arrayBuffer());
      const manifest = await readManifest(await openBackupZip(buffer));
      infos.push({
        id: file.name,
        exportedAt: manifest.exportedAt,
        appVersion: manifest.appVersion,
        counts: manifest.counts,
        sizeBytes: buffer.length,
      });
    } catch (error) {
      // An unreadable snapshot is skipped, not fatal — the list is a recovery
      // surface and must not be taken down by one bad file.
      console.warn("[Backup] Skipping unreadable snapshot", file.name, error);
    }
  }

  return infos.sort((a, b) => b.exportedAt.localeCompare(a.exportedAt));
}

export async function readSnapshot(
  userId: string,
  id: string,
): Promise<Buffer> {
  assertSupabase();
  if (!SNAPSHOT_ID.test(id)) {
    throw new BackupError("That is not a valid snapshot.");
  }

  const { data, error } = await supabase!.storage
    .from("backups")
    .download(`${userId}/${id}`);

  if (error || !data) {
    throw new BackupError("That snapshot no longer exists.");
  }

  return Buffer.from(await data.arrayBuffer());
}

// Prunes on count and on total bytes. The count alone is not a disk bound:
// nothing caps how large one snapshot is, these sit on the same volume as the
// SQLite database, and an import/rollback loop writes one every time. The
// newest is always kept, even if it alone exceeds the byte budget — dropping
// the only record of the state a user just left is worse than overshooting.
export async function pruneSnapshots(
  userId: string,
  keep: number,
): Promise<void> {
  if (!supabase) return;

  const { data } = await supabase.storage.from("backups").list(userId);
  if (!data) return;

  // Extract names and metadata from storage
  const snapshots = data.filter((f) => SNAPSHOT_ID.test(f.name));
  
  // Storage API sometimes returns empty placeholder files for folders (like `.emptyFolderPlaceholder`) 
  // but SNAPSHOT_ID regex protects against that.
  
  // Sort chronologically (lexical sort by filename ISO stamps) newest first
  const newestFirst = snapshots
    .sort((a, b) => b.name.localeCompare(a.name));

  const stalePaths: string[] = [];
  let runningBytes = 0;

  for (const [index, file] of newestFirst.entries()) {
    if (index >= keep) {
      stalePaths.push(`${userId}/${file.name}`);
      continue;
    }
    
    // Fallback to 0 if size property is unexpectedly missing
    const size = file.metadata?.size ?? 0;
    runningBytes += size;
    
    if (index > 0 && runningBytes > APP_CONSTANTS.BACKUP_SNAPSHOT_MAX_TOTAL_BYTES) {
      stalePaths.push(`${userId}/${file.name}`);
    }
  }

  if (stalePaths.length > 0) {
    const { error } = await supabase.storage.from("backups").remove(stalePaths);
    if (error) {
      console.warn("[Backup] Could not prune all snapshots", error);
    }
  }
}

