import { BackupError } from "@/lib/backup/manifest";
import { pruneSnapshots, readSnapshot } from "@/lib/backup/snapshot";
import { APP_CONSTANTS } from "@/lib/constants";
import { supabase } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => {
  return {
    supabase: {
      storage: {
        from: vi.fn(),
      },
    },
  };
});

describe("readSnapshot id validation", () => {
  // Each of these would escape the per-user directory if the id were joined
  // straight onto it. The regex guard prevents it.
  it.each([
    "../../../etc/passwd",
    "../u2/pre-import-2026-08-14T1032.zip",
    "/data/prod.db",
    "pre-import-2026-08-14T1032.zip/../../../dev.db",
    "..",
    "",
  ])("refuses %s", async (id) => {
    await expect(readSnapshot("u1", id)).rejects.toBeInstanceOf(BackupError);
  });

  it("refuses a name that is not a snapshot at all", async () => {
    await expect(readSnapshot("u1", "resume.pdf")).rejects.toBeInstanceOf(
      BackupError,
    );
  });
});

describe("pruneSnapshots", () => {
  const originalMaxTotalBytes = APP_CONSTANTS.BACKUP_SNAPSHOT_MAX_TOTAL_BYTES;

  const stamped = (n: number) => `pre-import-2026-08-14T10-0${n}-00-000Z.zip`;
  
  let mockList: any;
  let mockRemove: any;

  beforeEach(() => {
    (APP_CONSTANTS as { BACKUP_SNAPSHOT_MAX_TOTAL_BYTES: number }).BACKUP_SNAPSHOT_MAX_TOTAL_BYTES = 10_000;
    
    mockList = vi.fn();
    mockRemove = vi.fn().mockResolvedValue({ error: null });
    
    (supabase!.storage.from as any).mockReturnValue({
      list: mockList,
      remove: mockRemove,
    });
  });

  afterEach(() => {
    (APP_CONSTANTS as { BACKUP_SNAPSHOT_MAX_TOTAL_BYTES: number }).BACKUP_SNAPSHOT_MAX_TOTAL_BYTES =
      originalMaxTotalBytes;
    vi.clearAllMocks();
  });

  it("drops everything past the keep count, oldest first", async () => {
    mockList.mockResolvedValue({
      data: [
        { name: stamped(1), metadata: { size: 16 } },
        { name: stamped(2), metadata: { size: 16 } },
        { name: stamped(3), metadata: { size: 16 } },
        { name: stamped(4), metadata: { size: 16 } },
        { name: stamped(5), metadata: { size: 16 } },
      ],
      error: null
    });
    
    await pruneSnapshots("u1", 3);
    
    expect(mockRemove).toHaveBeenCalledWith([
      `u1/${stamped(2)}`,
      `u1/${stamped(1)}`,
    ]);
  });

  it("drops within the keep count once the byte budget is passed", async () => {
    const big = APP_CONSTANTS.BACKUP_SNAPSHOT_MAX_TOTAL_BYTES / 2 + 1024;
    mockList.mockResolvedValue({
      data: [
        { name: stamped(1), metadata: { size: big } },
        { name: stamped(2), metadata: { size: big } },
        { name: stamped(3), metadata: { size: big } },
      ],
      error: null
    });
    
    await pruneSnapshots("u1", 5);
    
    expect(mockRemove).toHaveBeenCalledWith([
      `u1/${stamped(2)}`,
      `u1/${stamped(1)}`,
    ]);
  });

  it("keeps the newest even when it alone exceeds the budget", async () => {
    mockList.mockResolvedValue({
      data: [
        { name: stamped(1), metadata: { size: APP_CONSTANTS.BACKUP_SNAPSHOT_MAX_TOTAL_BYTES + 1024 } },
      ],
      error: null
    });
    
    await pruneSnapshots("u1", 5);
    
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it("ignores files that are not snapshots", async () => {
    mockList.mockResolvedValue({
      data: [
        { name: "notes.txt", metadata: { size: 16 } },
        { name: stamped(1), metadata: { size: 16 } },
      ],
      error: null
    });
    
    await pruneSnapshots("u1", 0);
    
    expect(mockRemove).toHaveBeenCalledWith([`u1/${stamped(1)}`]);
  });
});
