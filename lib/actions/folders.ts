"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type FolderState = { error?: string; ok?: boolean };

const PRESETS = ["caio", "ceo", "cfo", "cmo", "cto"];

/** Only accept a known preset name; anything else falls back to null (auto). */
function normalizePreset(v: string): string | null {
  return PRESETS.includes(v) ? v : null;
}

/** Only accept a #rrggbb hex; anything else is null (no color). */
function normalizeColor(v: string): string | null {
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v : null;
}

export async function createFolder(
  _prev: FolderState,
  formData: FormData,
): Promise<FolderState> {
  const projectId = String(formData.get("project_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const parentId = String(formData.get("parent_id") ?? "").trim() || null;
  const avatarPreset = normalizePreset(String(formData.get("avatar_preset") ?? ""));
  const color = normalizeColor(String(formData.get("color") ?? ""));
  if (!projectId) return { error: "Missing project." };
  if (!name) return { error: "Folder name is required." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase.from("folders").insert({
    user_id: user.id,
    project_id: projectId,
    name,
    parent_id: parentId,
    avatar_preset: avatarPreset,
    color,
  });
  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function updateFolder(
  _prev: FolderState,
  formData: FormData,
): Promise<FolderState> {
  const id = String(formData.get("id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const avatarPreset = normalizePreset(String(formData.get("avatar_preset") ?? ""));
  const color = normalizeColor(String(formData.get("color") ?? ""));
  if (!id) return { error: "Missing folder." };
  if (!name) return { error: "Folder name is required." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // RLS scopes this to the owner; avatar/color are validated above.
  const { error } = await supabase
    .from("folders")
    .update({ name, avatar_preset: avatarPreset, color })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function deleteFolder(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  // Sources in this folder fall back to the project root (folder_id → null via
  // ON DELETE SET NULL); child folders are promoted to the root the same way.
  const { error } = await supabase.from("folders").delete().eq("id", id);
  if (error) throw error;

  revalidatePath(`/projects/${projectId}`);
}
