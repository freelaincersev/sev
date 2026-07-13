import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

const BUCKET = "sources";
const SIGNED_URL_TTL_SECONDS = 60;

/**
 * Redirects to a short-lived signed URL for a source's archived original.
 * The original lives in a PRIVATE bucket — never a public URL. Ownership is
 * enforced by RLS on both the sources row and the storage object (path prefix
 * = the user's uid); we also confirm the source belongs to this project.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; sourceId: string }> },
) {
  const { id: projectId, sourceId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { data: source } = await supabase
    .from("sources")
    .select("storage_path, project_id")
    .eq("id", sourceId)
    .maybeSingle();
  if (!source || source.project_id !== projectId || !source.storage_path) {
    return new NextResponse("Not found", { status: 404 });
  }

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(source.storage_path, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return new NextResponse("Not found", { status: 404 });

  return NextResponse.redirect(data.signedUrl);
}
