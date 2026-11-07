import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/prisma";
import { downloadSlip } from "@/lib/google-drive";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) {
    return new NextResponse(null, { status: 401 });
  }

  const { id } = await params;

  const slip = await getPrisma().expenseSlip.findUnique({
    where: { id },
    select: { driveFileId: true, contentType: true },
  });

  if (!slip || !slip.driveFileId) {
    return new NextResponse(null, { status: 404 });
  }

  let stream: ReadableStream<Uint8Array>;
  try {
    stream = await downloadSlip(slip.driveFileId);
  } catch {
    return new NextResponse(null, { status: 502 });
  }

  return new NextResponse(stream, {
    status: 200,
    headers: {
      "Content-Type": slip.contentType ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
