import { checkWebhookSecret, readTelegramConfig } from "@/lib/telegram-auth";
import { handleTelegramUpdate } from "@/lib/telegram-bot";

// Telegram calls this route; there is no user session. The secret header is the authentication.
export async function POST(request: Request) {
  const config = readTelegramConfig(process.env);
  if (!config.token || !config.webhookSecret) return new Response(null, { status: 503 });
  if (!checkWebhookSecret(request.headers.get("x-telegram-bot-api-secret-token"), config.webhookSecret)) {
    return new Response(null, { status: 401 });
  }

  let update: unknown;
  try {
    update = await request.json();
  } catch {
    // A body that is not JSON will never succeed, so do not ask Telegram to retry it.
    return new Response(null, { status: 200 });
  }

  try {
    await handleTelegramUpdate(update, config);
  } catch (error) {
    // The update was not recorded; a non-2xx response makes Telegram retry it.
    console.error("[telegram] webhook failed:", error instanceof Error ? error.name : "unknown");
    return new Response(null, { status: 500 });
  }
  return new Response(null, { status: 200 });
}
