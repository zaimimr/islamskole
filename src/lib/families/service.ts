import "server-only";
import { getIsAdmin } from "@/lib/auth";
import {
  createFamilyRepository,
  type FamilyDetails,
} from "@/lib/families/repository";
import { createClient } from "@/lib/supabase/server";

async function adminRepository() {
  if (!(await getIsAdmin())) throw new Error("Admin access required");
  return createFamilyRepository(await createClient());
}

export async function getAdminFamilyById(
  familyId: string,
): Promise<FamilyDetails | null> {
  return (await adminRepository()).findById(familyId);
}

export async function getAdminFamilies(): Promise<FamilyDetails[]> {
  return (await adminRepository()).findAll();
}

export async function getAdminFamilyForStudent(
  studentId: string,
): Promise<FamilyDetails | null> {
  return (await adminRepository()).findForStudent(studentId);
}

export async function getAdminFamilyForApplication(
  applicationId: string,
): Promise<FamilyDetails | null> {
  return (await adminRepository()).findForApplication(applicationId);
}
