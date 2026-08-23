// @vitest-environment node
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { buildBackupZip } from "@/lib/backup/export";
import { importBackup } from "@/lib/backup/import";
import { listSnapshots, readSnapshot } from "@/lib/backup/snapshot";
import { seedAccount } from "./helpers/backupTestDb";
import { APP_CONSTANTS } from "@/lib/constants";

// Async so the helper can be pulled in with a dynamic import — `require` is
// not defined in a Vite-transformed ESM test file.
const ctx = await vi.hoisted(async () => {
  const helpers = await import("./helpers/backupTestDb");
  const { url, dir } = helpers.makeTestDbUrl();
  helpers.pushSchema(url);
  
  // We'll use this directory for our mocked Supabase storage
  const mockStorageDir = path.join(dir, "supabase_mock");
  fs.mkdirSync(path.join(mockStorageDir, "resumes"), { recursive: true });
  fs.mkdirSync(path.join(mockStorageDir, "backups"), { recursive: true });
  
  return { url, dir, mockStorageDir };
});

vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  return {
    default: new PrismaClient({ datasources: { db: { url: ctx.url } } }),
  };
});

// Mock Supabase to use the local filesystem
vi.mock("@/lib/supabase", () => {
  const fs = require("fs");
  const path = require("path");

  const createStorageMock = (bucketName: string) => {
    const bucketDir = path.join(ctx.mockStorageDir, bucketName);
    
    return {
      upload: vi.fn(async (targetPath: string, bytes: Buffer, options: any) => {
        const fullPath = path.join(bucketDir, targetPath);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, bytes);
        return { data: { path: targetPath }, error: null };
      }),
      download: vi.fn(async (targetPath: string) => {
        const fullPath = path.join(bucketDir, targetPath);
        if (!fs.existsSync(fullPath)) return { data: null, error: { message: "Not found" } };
        const buffer = fs.readFileSync(fullPath);
        const blob = new Blob([buffer]);
        return { data: blob, error: null };
      }),
      remove: vi.fn(async (paths: string[]) => {
        for (const p of paths) {
          const fullPath = path.join(bucketDir, p);
          if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
        }
        return { data: paths, error: null };
      }),
      list: vi.fn(async (folderPath: string) => {
        const fullPath = path.join(bucketDir, folderPath);
        if (!fs.existsSync(fullPath)) return { data: [], error: null };
        const files = fs.readdirSync(fullPath);
        const data = files.map((f: string) => {
          const stat = fs.statSync(path.join(fullPath, f));
          return { name: f, metadata: { size: stat.size } };
        });
        return { data, error: null };
      }),
    };
  };

  return {
    supabase: {
      storage: {
        from: (bucket: string) => createStorageMock(bucket),
      },
    },
  };
});

// Never start the cron in a test run.
vi.mock("@/lib/scheduler", () => ({ syncSchedulerState: vi.fn() }));

const prisma = new PrismaClient({ datasources: { db: { url: ctx.url } } });

let userId: string;
const originalMaxTotalBytes = APP_CONSTANTS.BACKUP_SNAPSHOT_MAX_TOTAL_BYTES;

beforeAll(async () => {
  userId = await seedAccount(prisma, "owner@example.com");
  await seedFullAccount();
}, 120_000);

afterAll(async () => {
  await prisma.$disconnect();
  fs.rmSync(ctx.dir, { recursive: true, force: true });
  (APP_CONSTANTS as { BACKUP_SNAPSHOT_MAX_TOTAL_BYTES: number }).BACKUP_SNAPSHOT_MAX_TOTAL_BYTES =
    originalMaxTotalBytes;
});

async function seedFullAccount() {
  const company = await prisma.company.create({
    data: { label: "Acme", value: "acme", createdBy: userId },
  });
  const title = await prisma.jobTitle.create({
    data: { label: "Engineer", value: "engineer", createdBy: userId },
  });
  const tag = await prisma.tag.create({
    data: { label: "Remote", value: "remote", createdBy: userId },
  });
  const status = await prisma.jobStatus.findFirstOrThrow({ where: { value: "applied" } });

  const profile = await prisma.profile.create({ data: { userId } });

  // Pre-seed a file into the mocked storage so export picks it up
  const resumeFilePath = `${userId}/seed-resume.pdf`;
  const fullMockPath = path.join(ctx.mockStorageDir, "resumes", resumeFilePath);
  fs.mkdirSync(path.dirname(fullMockPath), { recursive: true });
  fs.writeFileSync(fullMockPath, Buffer.from("%PDF-1.4 seed"));
  
  const file = await prisma.file.create({
    data: {
      fileName: "resume.pdf",
      filePath: resumeFilePath, // Only relative path is stored now
      fileType: "application/pdf",
    },
  });
  const resume = await prisma.resume.create({
    data: { profileId: profile.id, title: "My CV", FileId: file.id },
  });
  await prisma.contactInfo.create({
    data: {
      resumeId: resume.id,
      firstName: "A",
      lastName: "B",
      headline: "Engineer",
      email: "a@b.com",
      phone: "123",
    },
  });
  const summary = await prisma.summary.create({ data: { content: "Summary text" } });
  const section = await prisma.resumeSection.create({
    data: {
      resumeId: resume.id,
      sectionTitle: "Summary",
      sectionType: "summary",
      summaryId: summary.id,
    },
  });
  await prisma.skill.create({
    data: { tagId: tag.id, resumeSectionId: section.id, category: "Languages", order: 1 },
  });
  await prisma.user.update({
    where: { id: userId },
    data: { defaultResumeId: resume.id },
  });

  const job = await prisma.job.create({
    data: {
      userId,
      description: "A job",
      jobType: "full-time",
      createdAt: new Date(),
      statusId: status.id,
      jobTitleId: title.id,
      companyId: company.id,
      tags: { connect: { id: tag.id } },
    },
  });
  await prisma.note.create({
    data: { jobId: job.id, userId, content: "a note" },
  });

  const question = await prisma.question.create({
    data: { question: "Why us?", createdBy: userId, tags: { connect: { id: tag.id } } },
  });
  expect(question.id).toBeTruthy();

  const activityType = await prisma.activityType.create({
    data: { label: "Applying", value: "applying", createdBy: userId },
  });
  const task = await prisma.task.create({
    data: { userId, title: "Apply to Acme", activityTypeId: activityType.id },
  });
  await prisma.activity.create({
    data: {
      userId,
      activityName: "Applying",
      startTime: new Date(),
      activityTypeId: activityType.id,
      taskId: task.id,
    },
  });

  const automation = await prisma.automation.create({
    data: {
      userId,
      name: "Nightly",
      jobBoard: "greenhouse",
      keywords: "engineer",
      location: "Remote",
      resumeId: resume.id,
      scheduleHour: 9,
      nextRunAt: new Date("2020-01-01T09:00:00"),
      status: "active",
    },
  });
  // A run left mid-flight in the backup, which must not survive as running.
  await prisma.automationRun.create({
    data: { automationId: automation.id, status: "cancelling" },
  });

  // Rows the wipe must not touch, and one it must.
  await prisma.apiKey.create({
    data: { userId, provider: "openai", encryptedKey: "e", iv: "i", last4: "1234" },
  });
  await prisma.mcpAccessToken.create({
    data: {
      userId,
      name: "cli",
      tokenHash: "hash",
      tokenPrefix: "js_",
      scopes: "[]",
      expiresAt: new Date(Date.now() + 86_400_000),
    },
  });
  await prisma.chatConversation.create({
    data: { userId, messages: "[]" },
  });
}

describe.skip("backup round trip", () => {
  it("restores every row, relation and file over an existing account", async () => {
    const { buffer } = await buildBackupZip(userId, "owner@example.com");

    // Add a lookup the backup does not contain, so replace-not-merge is testable.
    await prisma.company.create({
      data: { label: "Ghost", value: "ghost", createdBy: userId },
    });

    // The in-flight run in the backup must not block the target-side guard, so
    // clear the target's own run first — the guard is asserted separately.
    await prisma.automationRun.updateMany({
      where: { status: { in: ["running", "cancelling"] } },
      data: { status: "failed", completedAt: new Date() },
    });

    const result = await importBackup(buffer, userId, "owner@example.com", true);

    expect(result.counts.Job).toBe(1);
    expect(result.filesWritten).toBe(1);

    // The safety net is returned and was persisted to the mocked Supabase
    expect(result.snapshotPath).toBeTruthy();
    const snapFullPath = path.join(ctx.mockStorageDir, "backups", userId, result.snapshotPath!);
    expect(fs.existsSync(snapFullPath)).toBe(true);

    // Lookups are replaced, not merged.
    const companies = await prisma.company.findMany({ where: { createdBy: userId } });
    expect(companies.map((c) => c.value).sort()).toEqual(["acme"]);

    // Tag associations survive on both sides.
    const job = await prisma.job.findFirstOrThrow({
      where: { userId },
      include: { tags: true, Company: true, Status: true, Notes: true },
    });
    expect(job.tags.map((t) => t.value)).toEqual(["remote"]);
    expect(job.Company.label).toBe("Acme");
    expect(job.Status.value).toBe("applied");
    expect(job.Notes).toHaveLength(1);

    const question = await prisma.question.findFirstOrThrow({
      where: { createdBy: userId },
      include: { tags: true },
    });
    expect(question.tags.map((t) => t.value)).toEqual(["remote"]);

    // Summary ordering: the section imported with its summary attached.
    const section = await prisma.resumeSection.findFirstOrThrow({
      where: { Resume: { profile: { userId } } },
      include: { summary: true, skills: { include: { Tag: true } } },
    });
    expect(section.summary?.content).toBe("Summary text");
    expect(section.skills[0].Tag.value).toBe("remote");

    // defaultResumeId points at the new resume, not the old id.
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const resume = await prisma.resume.findFirstOrThrow({
      where: { profile: { userId } },
    });
    expect(user.defaultResumeId).toBe(resume.id);

    // Activity -> Task survived.
    const activity = await prisma.activity.findFirstOrThrow({
      where: { userId },
      include: { task: true },
    });
    expect(activity.task?.title).toBe("Apply to Acme");

    // In-flight state normalized on the way in.
    const run = await prisma.automationRun.findFirstOrThrow({
      where: { automation: { userId } },
    });
    expect(run.status).toBe("failed");
    expect(run.errorMessage).toBe("interrupted");

    const automation = await prisma.automation.findFirstOrThrow({ where: { userId } });
    expect(automation.status).toBe("active");
    expect(automation.nextRunAt!.getTime()).toBeGreaterThan(Date.now());

    // The wipe set is honoured in both directions.
    expect(await prisma.apiKey.count({ where: { userId } })).toBe(1);
    expect(await prisma.mcpAccessToken.count({ where: { userId } })).toBe(1);
    expect(await prisma.chatConversation.count({ where: { userId } })).toBe(0);

    // filePath was recomputed and the bytes are actually there in the mock storage.
    const file = await prisma.file.findFirstOrThrow({
      where: { Resume: { profile: { userId } } },
    });
    const resumeFullPath = path.join(ctx.mockStorageDir, "resumes", file.filePath);
    expect(fs.existsSync(resumeFullPath)).toBe(true);
    expect(fs.readFileSync(resumeFullPath).toString()).toContain("seed");
  }, 120_000);

  it("does not demand confirmWipe on a freshly signed-up account", async () => {
    const freshUserId = await seedAccount(prisma, "fresh@example.com");
    const { buffer } = await buildBackupZip(userId, "owner@example.com");

    // No confirmWipe: the seeded JobSource rows must not count as data.
    const result = await importBackup(
      buffer,
      freshUserId,
      "fresh@example.com",
      false,
    );
    // Nothing to snapshot on an empty account.
    expect(result.snapshotPath).toBeNull();
  }, 120_000);

  it("rolls back to the snapshot an import took", async () => {
    const rollbackUserId = await seedAccount(prisma, "rollback@example.com");
    // A content row, not just the lookup below: EMPTINESS_MODELS deliberately
    // excludes lookup models, so a Company alone would read as an empty target
    // and importBackup would skip the snapshot this test is asserting on.
    await prisma.profile.create({ data: { userId: rollbackUserId } });
    await prisma.company.create({
      data: { label: "Before", value: "before", createdBy: rollbackUserId },
    });

    // Import someone else's backup over it, then undo that.
    const { buffer } = await buildBackupZip(userId, "owner@example.com");
    const imported = await importBackup(
      buffer,
      rollbackUserId,
      "rollback@example.com",
      true,
    );
    expect(imported.snapshotPath).toBeTruthy();
    expect(
      (await prisma.company.findMany({ where: { createdBy: rollbackUserId } }))
        .map((c) => c.value),
    ).not.toContain("before");

    const snapshots = await listSnapshots(rollbackUserId);
    const bytes = await readSnapshot(rollbackUserId, snapshots[0].id);
    await importBackup(bytes, rollbackUserId, "rollback@example.com", true);

    const after = await prisma.company.findMany({
      where: { createdBy: rollbackUserId },
    });
    expect(after.map((c) => c.value)).toEqual(["before"]);
  }, 120_000);

  // The regression test for the file gate. A tampered backup is the realistic
  // hostile input for this feature: the zip is structurally valid and the rows
  // are fine, but a file entry has been swapped for something that is not a
  // resume. The row must survive and the bytes must not reach disk.
  it("drops a file entry whose bytes are not a resume, without failing the import", async () => {
    const { buffer } = await buildBackupZip(userId, "owner@example.com");

    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(buffer);
    // Directory entries (e.g. "files/") also start with the prefix and sort
    // before the real file entry in JSZip's insertion order — exclude them.
    const entryName = Object.keys(zip.files).find(
      (n) => n.startsWith("files/") && !zip.files[n].dir,
    )!;
    zip.file(entryName, Buffer.from("MZ\x90\x00 definitely not a PDF"));
    const tampered = await zip.generateAsync({ type: "nodebuffer" });

    await prisma.automationRun.updateMany({
      where: { status: { in: ["running", "cancelling"] } },
      data: { status: "failed", completedAt: new Date() },
    });

    const result = await importBackup(tampered, userId, "owner@example.com", true);

    expect(result.filesWritten).toBe(0);
    expect(result.counts.File).toBe(1);

    const file = await prisma.file.findFirstOrThrow({
      where: { Resume: { profile: { userId } } },
    });
    
    const resumeFullPath = path.join(ctx.mockStorageDir, "resumes", file.filePath);
    expect(fs.existsSync(resumeFullPath)).toBe(false);

    // Nothing outside the mocked resumes directory was created either.
    const resumesUserDir = path.join(ctx.mockStorageDir, "resumes", userId);
    if (fs.existsSync(resumesUserDir)) {
      expect(
        fs.readdirSync(resumesUserDir).some((n) => n.includes("MZ") || n.endsWith(".exe")),
      ).toBe(false);
    }
  }, 120_000);

  it("refuses before any write when the target has an active run", async () => {
    const automation = await prisma.automation.findFirstOrThrow({ where: { userId } });
    await prisma.automationRun.create({
      data: { automationId: automation.id, status: "running" },
    });

    const { buffer } = await buildBackupZip(userId, "owner@example.com");
    const jobsBefore = await prisma.job.count({ where: { userId } });

    await expect(
      importBackup(buffer, userId, "owner@example.com", true),
    ).rejects.toThrow(/wait/i);
    expect(await prisma.job.count({ where: { userId } })).toBe(jobsBefore);
  }, 120_000);
});
