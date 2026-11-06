import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock server-only so it doesn't throw in test env
vi.mock("server-only", () => ({}));

// Mock prisma
vi.mock("@/lib/prisma", () => ({
  getPrisma: vi.fn(),
}));

// Mock token-crypto
vi.mock("@/lib/token-crypto", () => ({
  decryptToken: vi.fn().mockReturnValue("fake-refresh-token"),
  encryptToken: vi.fn().mockReturnValue("encrypted-token"),
}));

import { getPrisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/token-crypto";
import {
  DriveAuthError,
  DriveNotConnectedError,
  downloadSlip,
  trashSlip,
  uploadSlip,
} from "@/lib/google-drive";

const mockPrisma = {
  driveConnection: {
    findUnique: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  },
};

function setupEnv() {
  process.env.AUTH_SECRET = "test-secret-at-least-32-chars-long!";
  process.env.AUTH_GOOGLE_ID = "test-client-id";
  process.env.AUTH_GOOGLE_SECRET = "test-client-secret";
}

function mockFetch(responses: Array<{ ok: boolean; status?: number; body?: unknown; stream?: ReadableStream }>) {
  let call = 0;
  global.fetch = vi.fn().mockImplementation(() => {
    const r = responses[call++] ?? responses[responses.length - 1];
    return Promise.resolve({
      ok: r.ok,
      status: r.status ?? (r.ok ? 200 : 400),
      json: () => Promise.resolve(r.body ?? {}),
      text: () => Promise.resolve(JSON.stringify(r.body ?? {})),
      body: r.stream ?? null,
    });
  });
}

beforeEach(() => {
  vi.mocked(getPrisma).mockReturnValue(mockPrisma as never);
  setupEnv();
  vi.clearAllMocks();
});

describe("DriveNotConnectedError", () => {
  it("is thrown when no connection row exists", async () => {
    mockPrisma.driveConnection.findUnique.mockResolvedValue(null);
    mockFetch([{ ok: true, body: { access_token: "tok" } }]);
    await expect(uploadSlip(new Uint8Array([1]), "file.jpg", "image/jpeg")).rejects.toBeInstanceOf(
      DriveNotConnectedError,
    );
  });
});

describe("DriveAuthError", () => {
  it("is thrown when the stored token cannot be decrypted", async () => {
    mockPrisma.driveConnection.findUnique.mockResolvedValue({
      id: "default",
      encryptedRefreshToken: "unreadable",
      folderId: "folder",
    });
    vi.mocked(decryptToken).mockImplementationOnce(() => {
      throw new Error("Token decryption failed");
    });
    mockFetch([{ ok: true, body: { access_token: "tok" } }]);
    await expect(downloadSlip("file-id")).rejects.toBeInstanceOf(DriveAuthError);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("is thrown when Google returns invalid_grant", async () => {
    mockPrisma.driveConnection.findUnique.mockResolvedValue({
      id: "default",
      encryptedRefreshToken: "encrypted",
      folderId: "folder123",
    });
    mockFetch([{ ok: false, status: 400, body: { error: "invalid_grant" } }]);
    await expect(uploadSlip(new Uint8Array([1]), "file.jpg", "image/jpeg")).rejects.toBeInstanceOf(
      DriveAuthError,
    );
  });
});

describe("uploadSlip", () => {
  it("calls the Drive multipart upload endpoint and returns file id", async () => {
    mockPrisma.driveConnection.findUnique.mockResolvedValue({
      id: "default",
      encryptedRefreshToken: "encrypted",
      folderId: "folder123",
    });
    mockFetch([
      { ok: true, body: { access_token: "tok" } }, // token refresh
      { ok: true, body: { id: "file-abc" } },       // upload
    ]);

    const id = await uploadSlip(new Uint8Array([0xff, 0xd8, 0xff]), "slip.jpg", "image/jpeg");
    expect(id).toBe("file-abc");
    expect(global.fetch).toHaveBeenCalledTimes(2);
    const uploadCall = vi.mocked(global.fetch).mock.calls[1];
    expect(String(uploadCall[0])).toContain("uploadType=multipart");
  });
});

describe("downloadSlip", () => {
  it("fetches using alt=media and returns the body stream", async () => {
    mockPrisma.driveConnection.findUnique.mockResolvedValue({
      id: "default",
      encryptedRefreshToken: "encrypted",
      folderId: "folder123",
    });
    const fakeStream = new ReadableStream();
    mockFetch([
      { ok: true, body: { access_token: "tok" } },
      { ok: true, stream: fakeStream },
    ]);

    const stream = await downloadSlip("file-xyz");
    expect(stream).toBe(fakeStream);
    const downloadCall = vi.mocked(global.fetch).mock.calls[1];
    expect(String(downloadCall[0])).toContain("alt=media");
  });
});

describe("trashSlip", () => {
  it("sends a PATCH with trashed: true", async () => {
    mockPrisma.driveConnection.findUnique.mockResolvedValue({
      id: "default",
      encryptedRefreshToken: "encrypted",
      folderId: "folder123",
    });
    mockFetch([
      { ok: true, body: { access_token: "tok" } },
      { ok: true, body: {} },
    ]);

    await expect(trashSlip("file-to-trash")).resolves.toBeUndefined();
    const patchCall = vi.mocked(global.fetch).mock.calls[1];
    expect((patchCall[1] as RequestInit).method).toBe("PATCH");
    const body = JSON.parse((patchCall[1] as RequestInit).body as string);
    expect(body.trashed).toBe(true);
  });

  it("treats 404 as success (file already gone)", async () => {
    mockPrisma.driveConnection.findUnique.mockResolvedValue({
      id: "default",
      encryptedRefreshToken: "encrypted",
      folderId: "folder123",
    });
    mockFetch([
      { ok: true, body: { access_token: "tok" } },
      { ok: false, status: 404, body: {} },
    ]);

    await expect(trashSlip("gone-file")).resolves.toBeUndefined();
  });
});
