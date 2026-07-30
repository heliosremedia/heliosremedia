import "server-only";

import { Resend } from "resend";
import { oneClickUnsubscribeHeaders } from "../preference-rules";
import {
  batchIdempotencyKey,
  chunkMessages,
  deliveryContentHash,
  normalizeResendError,
  providerAdminMessage,
  resolveDeliveryConfig,
  RESEND_TIMEOUT_MS,
  type EmailProviderErrorCode,
  type NormalizedProviderError,
} from "./resend-core";

export type DeliverySource = "newsletter" | "campaign" | "referral" | "test";

export class EmailDeliveryError extends Error {
  constructor(
    public readonly code: EmailProviderErrorCode,
    message: string,
    public readonly provider: NormalizedProviderError | null = null,
  ) {
    super(message);
    this.name = "EmailDeliveryError";
  }
}

function configuredClient() {
  const config = resolveDeliveryConfig({
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    CAMPAIGN_EMAIL_FROM: process.env.CAMPAIGN_EMAIL_FROM,
    PORTAL_EMAIL_FROM: process.env.PORTAL_EMAIL_FROM,
    CAMPAIGN_REPLY_TO: process.env.CAMPAIGN_REPLY_TO,
  });
  if (!config.configured || !config.apiKey || !config.from) {
    throw new EmailDeliveryError("EMAIL_PROVIDER_NOT_CONFIGURED", providerAdminMessage("EMAIL_PROVIDER_NOT_CONFIGURED"));
  }
  if (!config.senderValid) {
    throw new EmailDeliveryError("EMAIL_PROVIDER_SENDER", providerAdminMessage("EMAIL_PROVIDER_SENDER"));
  }
  return {
    resend: new Resend(config.apiKey, { userAgent: "helios-studio/1.0" }),
    from: config.from,
    replyTo: config.replyTo,
  };
}

function safeLog(event: string, metadata: Record<string, unknown>) {
  console.info(`[email-delivery] ${event}`, metadata);
}

function requestId(headers: Record<string, string> | null) {
  return headers?.["x-request-id"] || headers?.["request-id"] || headers?.["cf-ray"] || null;
}

async function withTimeout<T>(operation: Promise<T>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new EmailDeliveryError(
          "EMAIL_PROVIDER_TRANSIENT",
          providerAdminMessage("EMAIL_PROVIDER_TRANSIENT"),
          {
            code: "EMAIL_PROVIDER_TRANSIENT",
            message: "Provider request timed out.",
            status: null,
            providerType: "timeout",
            providerRequestId: null,
            retryable: true,
          },
        )), RESEND_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function rejectProvider(
  error: unknown,
  headers: Record<string, string> | null,
  metadata: Record<string, unknown>,
): never {
  const normalized = normalizeResendError(error, headers);
  safeLog(
    normalized.code === "EMAIL_PROVIDER_RATE_LIMIT" ? "provider_rate_limited" :
      normalized.providerType === "timeout" ? "provider_timeout" : "provider_rejected",
    {
      ...metadata,
      providerStatus: normalized.status,
      providerErrorType: normalized.providerType,
      providerRequestId: normalized.providerRequestId,
      retryable: normalized.retryable,
    },
  );
  throw new EmailDeliveryError(normalized.code, providerAdminMessage(normalized.code), normalized);
}

async function providerRequest<T extends {
  error: unknown | null;
  headers: Record<string, string> | null;
}>(
  operation: () => Promise<T>,
  metadata: Record<string, unknown>,
): Promise<T & { error: null }> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await withTimeout(operation());
      if (!response.error) return response as T & { error: null };
      const normalized = normalizeResendError(response.error, response.headers);
      if (!normalized.retryable || attempt === 2) {
        rejectProvider(response.error, response.headers, { ...metadata, attempt: attempt + 1 });
      }
    } catch (error) {
      if (!(error instanceof EmailDeliveryError) || !error.provider?.retryable || attempt === 2) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
  }
  throw new EmailDeliveryError("EMAIL_PROVIDER_UNKNOWN", providerAdminMessage("EMAIL_PROVIDER_UNKNOWN"));
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  source: DeliverySource;
  operationId?: string;
  idempotencyKey?: string;
  from?: string | null;
  replyTo?: string | null;
}) {
  const config = configuredClient();
  const metadata = { source: input.source, operationId: input.operationId ?? null, recipientCount: 1 };
  safeLog("test_send_started", metadata);
  const response = await providerRequest(() => config.resend.emails.send({
    from: input.from?.trim() || config.from,
    to: [input.to],
    replyTo: input.replyTo?.trim() || config.replyTo || undefined,
    subject: input.subject,
    html: input.html,
  }, input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined), metadata);
  if (!response.data?.id) {
    rejectProvider(
      { name: "application_error", message: "Provider response did not include a message ID.", statusCode: null },
      response.headers,
      metadata,
    );
  }
  safeLog("test_send_accepted", {
    ...metadata,
    providerMessageId: response.data.id,
    providerRequestId: requestId(response.headers),
  });
  return { provider: "resend" as const, messageId: response.data.id };
}

export async function sendEmailBatch(input: {
  campaignId: string;
  messages: Array<{ to: string; subject: string; html: string; unsubscribeUrl?: string }>;
  source: Exclude<DeliverySource, "test">;
  revisionKey?: string;
  from?: string | null;
  replyTo?: string | null;
}) {
  const config = configuredClient();
  const from = input.from?.trim() || config.from;
  const replyTo = input.replyTo?.trim() || config.replyTo;
  const chunks = chunkMessages(input.messages);
  const results: Array<{ id: string }> = [];
  const revisionKey = input.revisionKey || deliveryContentHash(input.messages);

  for (let batchIndex = 0; batchIndex < chunks.length; batchIndex += 1) {
    const messages = chunks[batchIndex];
    const idempotencyKey = batchIdempotencyKey({
      campaignId: input.campaignId,
      revisionKey,
      batchNumber: batchIndex,
      messages,
    });
    const metadata = {
      source: input.source,
      campaignId: input.campaignId,
      batchNumber: batchIndex + 1,
      recipientCount: messages.length,
    };
    safeLog("batch_send_started", metadata);
    const response = await providerRequest(() => config.resend.batch.send(messages.map((message) => ({
      from,
      to: [message.to],
      replyTo: replyTo || undefined,
      subject: message.subject,
      html: message.html,
      headers: message.unsubscribeUrl ? oneClickUnsubscribeHeaders(message.unsubscribeUrl) : undefined,
    })), { idempotencyKey }), metadata);
    const accepted = response.data?.data;
    if (!accepted || accepted.length !== messages.length || accepted.some((message) => !message.id)) {
      rejectProvider(
        { name: "application_error", message: "Provider batch response did not include every message ID.", statusCode: null },
        response.headers,
        metadata,
      );
    }
    results.push(...accepted);
    safeLog("batch_send_accepted", {
      ...metadata,
      providerMessageCount: accepted.length,
      providerRequestId: requestId(response.headers),
    });
  }
  return results;
}
