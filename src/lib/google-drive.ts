import "server-only";
import { getPrisma } from "@/lib/prisma";
import { decryptToken, encryptToken } from "@/lib/token-crypto";

const FOLDER_NAME = "Subtrack Slips";

export class DriveNotConnectedError extends Error {
  constructor() {
    super("ยังไม่ได้เชื่อมต่อ Google Drive กรุณาเชื่อมต่อ Google Drive ก่อน");
    this.name = "DriveNotConnectedError";
  }
}

export class DriveAuthError extends Error {
  constructor() {
    super("การเชื่อมต่อ Google Drive หมดอายุ กรุณาเชื่อมต่อ Google Drive ใหม่อีกครั้ง");
    this.name = "DriveAuthError";
  }
}

function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return secret;
}

async function getAccessToken(): Promise<string> {
  const prisma = getPrisma();
  const conn = await prisma.driveConnection.findUnique({ where: { id: "default" } });
  if (!conn) throw new DriveNotConnectedError();

  const secret = getAuthSecret();
  let refreshToken: string;
  try {
    refreshToken = decryptToken(conn.encryptedRefreshToken, secret);
  } catch {
    // The stored token is unreadable, for example after AUTH_SECRET was rotated.
    throw new DriveAuthError();
  }

  const clientId = process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google OAuth credentials not configured");

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    if (text.includes("invalid_grant")) {
      throw new DriveAuthError();
    }
    // Do not log response body (may contain tokens)
    throw new Error(`Failed to refresh access token: HTTP ${res.status}`);
  }

  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error("No access token in refresh response");
  }
  return data.access_token;
}

export async function ensureFolder(): Promise<string> {
  const prisma = getPrisma();
  const conn = await prisma.driveConnection.findUnique({ where: { id: "default" } });
  if (!conn) throw new DriveNotConnectedError();

  if (conn.folderId) return conn.folderId;

  const accessToken = await getAccessToken();

  // Create folder
  const res = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to create Drive folder: HTTP ${res.status}`);
  }

  const data = (await res.json()) as { id?: string };
  const folderId = data.id;
  if (!folderId) throw new Error("No folder id in Drive response");

  await prisma.driveConnection.update({
    where: { id: "default" },
    data: { folderId },
  });

  return folderId;
}

export async function uploadSlip(
  bytes: Uint8Array,
  name: string,
  contentType: string,
): Promise<string> {
  const folderId = await ensureFolder();
  const accessToken = await getAccessToken();

  const metadata = JSON.stringify({
    name,
    mimeType: contentType,
    parents: [folderId],
  });

  const boundary = "subtrack_boundary_" + Math.random().toString(36).slice(2);
  const metaPart =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${metadata}\r\n`;
  const dataPart =
    `--${boundary}\r\n` +
    `Content-Type: ${contentType}\r\n\r\n`;
  const closePart = `\r\n--${boundary}--`;

  const metaBytes = new TextEncoder().encode(metaPart);
  const dataPartBytes = new TextEncoder().encode(dataPart);
  const closeBytes = new TextEncoder().encode(closePart);

  const body = new Uint8Array(
    metaBytes.length + dataPartBytes.length + bytes.length + closeBytes.length,
  );
  body.set(metaBytes, 0);
  body.set(dataPartBytes, metaBytes.length);
  body.set(bytes, metaBytes.length + dataPartBytes.length);
  body.set(closeBytes, metaBytes.length + dataPartBytes.length + bytes.length);

  const res = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );

  if (!res.ok) {
    throw new Error(`Failed to upload slip to Drive: HTTP ${res.status}`);
  }

  const data = (await res.json()) as { id?: string };
  const fileId = data.id;
  if (!fileId) throw new Error("No file id in Drive upload response");
  return fileId;
}

export async function downloadSlip(fileId: string): Promise<ReadableStream<Uint8Array>> {
  const accessToken = await getAccessToken();

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!res.ok) {
    throw new Error(`Failed to download slip from Drive: HTTP ${res.status}`);
  }

  if (!res.body) throw new Error("Drive response has no body");
  return res.body;
}

export async function trashSlip(fileId: string): Promise<void> {
  const accessToken = await getAccessToken();

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ trashed: true }),
    },
  );

  // 404 means the file is already gone — treat as success
  if (res.status === 404) return;

  if (!res.ok) {
    throw new Error(`Failed to trash slip in Drive: HTTP ${res.status}`);
  }
}

export async function upsertDriveConnection(encryptedRefreshToken: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.driveConnection.upsert({
    where: { id: "default" },
    update: { encryptedRefreshToken, folderId: null },
    create: { id: "default", encryptedRefreshToken },
  });
}

export async function getDriveConnection() {
  return getPrisma().driveConnection.findUnique({ where: { id: "default" } });
}

export { encryptToken, getAuthSecret };
