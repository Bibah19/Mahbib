import "server-only";
import * as blob from "@vercel/blob";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, writeFile, link, unlink } from "node:fs/promises";
import path from "node:path";

export { BlobNotFoundError, BlobPreconditionFailedError } from "@vercel/blob";

// Never silently use an ephemeral filesystem on a production deployment.
function isLocalStorage(): boolean {
  const hasCredentials = Boolean(
    process.env.BLOB_READ_WRITE_TOKEN?.trim() ||
    (process.env.BLOB_STORE_ID?.trim() && process.env.VERCEL_OIDC_TOKEN?.trim()),
  );
  return !hasCredentials && !process.env.VERCEL && process.env.NODE_ENV !== "production";
}

function localPath(pathname: string): string {
  const root = path.resolve(process.cwd(), "data", "blob-local");
  if (!pathname.startsWith("reservations/") || pathname.includes("\\") ||
      pathname.split("/").some((part) => part === "." || part === "..")) {
    throw new Error("Invalid reservation storage path.");
  }
  const resolved = path.resolve(root, pathname);
  if (!resolved.startsWith(root + path.sep)) throw new Error("Invalid storage path.");
  return resolved;
}

function hasCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

export async function get(pathname: string, options: { access: "private"; useCache: false }) {
  if (!isLocalStorage()) return blob.get(pathname, options);
  try {
    const text = await readFile(localPath(pathname), "utf8");
    return { statusCode: 200 as const, stream: new Response(text).body! };
  } catch (error) {
    if (hasCode(error, "ENOENT")) throw new blob.BlobNotFoundError();
    throw error;
  }
}

export async function put(
  pathname: string,
  body: string,
  options: { access: "private"; contentType: string; addRandomSuffix: false; allowOverwrite: false },
): Promise<void> {
  if (!isLocalStorage()) {
    await blob.put(pathname, body, options);
    return;
  }
  const destination = localPath(pathname);
  await mkdir(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.${randomUUID()}.tmp`;
  await writeFile(temporary, body, { flag: "wx", mode: 0o600 });
  try {
    // Publish the complete file atomically, without replacing an occupied seat.
    await link(temporary, destination);
  } catch (error) {
    if (hasCode(error, "EEXIST")) throw new blob.BlobPreconditionFailedError();
    throw error;
  } finally {
    await unlink(temporary);
  }
}

export async function del(pathname: string): Promise<void> {
  if (!isLocalStorage()) return blob.del(pathname);
  try {
    await unlink(localPath(pathname));
  } catch (error) {
    if (!hasCode(error, "ENOENT")) throw error;
  }
}

export async function list(options: { prefix: string; limit: number; cursor?: string }) {
  if (!isLocalStorage()) return blob.list(options);
  const root = localPath("reservations/");
  const paths: string[] = [];
  async function walk(directory: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (hasCode(error, "ENOENT")) return;
      throw error;
    }
    for (const entry of entries) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(filename);
      else if (entry.isFile() && entry.name.endsWith(".json")) {
        const pathname = `reservations/${path.relative(root, filename).split(path.sep).join("/")}`;
        if (pathname.startsWith(options.prefix)) paths.push(pathname);
      }
    }
  }
  await walk(root);
  paths.sort();
  const offset = Number(options.cursor ?? 0);
  const end = offset + options.limit;
  return {
    blobs: paths.slice(offset, end).map((pathname) => ({ pathname })),
    cursor: end < paths.length ? String(end) : undefined,
    hasMore: end < paths.length,
  };
}
