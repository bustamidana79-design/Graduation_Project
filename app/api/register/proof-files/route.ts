import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const DOCUMENTS_BUCKET = "documents";
const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function normalizeText(value: FormDataEntryValue | null, maxLength = 1200) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^\w.\-]+/g, "_").slice(0, 120) || "proof-file";
}

function collectExistingUrls(value: unknown) {
  return Array.isArray(value) ? value.filter((url): url is string => typeof url === "string" && url.length > 0) : [];
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const userId = normalizeText(formData.get("userId"), 80);
    const email = normalizeText(formData.get("email"), 320).toLowerCase();
    const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File);

    if (!userId || !email) {
      return jsonError("Missing registration user details.", 400);
    }

    if (files.length === 0) {
      return jsonError("No proof files were selected.", 400);
    }

    if (files.length > MAX_FILES) {
      return jsonError(`You can upload up to ${MAX_FILES} proof files.`, 400);
    }

    const oversized = files.find((file) => file.size > MAX_FILE_SIZE);
    if (oversized) {
      return jsonError(`File ${oversized.name} is larger than 10 MB.`, 400);
    }

    const admin = createSupabaseAdmin();
    const { data: authUser, error: authError } = await admin.auth.admin.getUserById(userId);
    const authEmail = authUser.user?.email?.toLowerCase();

    if (authError || !authUser.user || authEmail !== email) {
      return jsonError("Could not verify the newly created account.", 403);
    }

    const { data: application, error: applicationError } = await admin
      .from("applications")
      .select("id, proof_json")
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (applicationError) {
      return jsonError(applicationError.message, 500);
    }

    if (!application?.id) {
      return jsonError("Pending registration application was not found.", 404);
    }

    const uploadedUrls: string[] = [];
    const uploadedAt = Date.now();

    for (const [index, file] of files.entries()) {
      const filePath = `${userId}/${uploadedAt}-${index}-${sanitizeFileName(file.name)}`;
      const arrayBuffer = await file.arrayBuffer();
      const { error: uploadError } = await admin.storage.from(DOCUMENTS_BUCKET).upload(filePath, arrayBuffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

      if (uploadError) {
        return jsonError(`Failed to upload ${file.name}: ${uploadError.message}`, 500);
      }

      const { data: urlData } = admin.storage.from(DOCUMENTS_BUCKET).getPublicUrl(filePath);
      uploadedUrls.push(urlData.publicUrl);
    }

    const existingProofJson = asRecord(application.proof_json);
    const proofJson = {
      ...existingProofJson,
      proof_link_1: normalizeText(formData.get("proof_link_1"), 1000) || existingProofJson.proof_link_1 || null,
      proof_link_2: normalizeText(formData.get("proof_link_2"), 1000) || existingProofJson.proof_link_2 || null,
      page_username: normalizeText(formData.get("page_username"), 200) || existingProofJson.page_username || null,
      note: normalizeText(formData.get("note"), 1200) || existingProofJson.note || null,
      file_urls: [...collectExistingUrls(existingProofJson.file_urls), ...uploadedUrls],
    };

    const { error: updateError } = await admin
      .from("applications")
      .update({ proof_json: proofJson })
      .eq("id", application.id);

    if (updateError) {
      return jsonError(updateError.message, 500);
    }

    return NextResponse.json({ file_urls: uploadedUrls });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to upload proof files.";
    return jsonError(message, 500);
  }
}
