import prisma from "@/lib/db";
import { getCurrentUser } from "@/utils/user.utils";

// Not a "use server" module: it exports selects, so it stays internal to
// src/actions/profile/ and is never imported by a client component.

export const requireUser = async () => {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Not authenticated");
  }
  return user;
};

// Canonical IDOR guard for actions that only need to confirm resume ownership
export const assertResumeOwnership = async (
  resumeId: string,
  userId: string,
) => {
  const owned = await prisma.resume.findUnique({
    where: { id: resumeId, profile: { userId } },
    select: { id: true },
  });
  if (!owned) throw new Error("Resume not found or access denied");
};

export const createFileEntry = async (
  fileName: string | undefined,
  filePath: string | undefined,
) => {
  const newFileEntry = await prisma.file.create({
    data: {
      fileName: fileName!,
      filePath: filePath!,
      fileType: "resume",
    },
  });
  return newFileEntry.id;
};

export const resumeListSelect = {
  id: true,
  profileId: true,
  FileId: true,
  createdAt: true,
  updatedAt: true,
  title: true,
  _count: {
    select: {
      Job: true,
      ResumeSections: true,
    },
  },
} as const;

// Full section tree for cloning. Unlike resumeDetailInclude this includes
// `others` and omits File/Tag joins, which a copy does not need.
export const resumeCopySelect = {
  id: true,
  profileId: true,
  title: true,
  ContactInfo: true,
  ResumeSections: {
    include: {
      summary: true,
      workExperiences: true,
      educations: true,
      licenseOrCertifications: true,
      others: true,
      skills: true,
    },
  },
} as const;
