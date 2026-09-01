import { randomUUID } from "node:crypto";
import {
	type ClaimedEmail,
	claimDueEmails,
	countEmailOutbox,
	failEmail,
	markEmailAccepted,
	pruneEmailOutbox,
	releaseEmailClaim,
	scheduleEmailRetry,
} from "@virtool/data/email/outbox";
import {
	computeEmailRetryDelay,
	EMAIL_MAX_ATTEMPTS,
} from "@virtool/data/email/retry";
import {
	buildProviderIdempotencyKey,
	type EmailSendOutcome,
	sendEmailViaResend,
} from "@virtool/data/email/send";
import {
	type EmailDeliveryState,
	getEmailSettings,
	resolveEmailDelivery,
} from "@virtool/data/email/settings";
import { renderEmailTemplate } from "@virtool/data/email/templates";
import type { Logger } from "@virtool/logger";
import { z } from "zod";
import { defineTask } from "../framework/define";
import type { TaskContext } from "./registry";

/**
 * `deliver_email` carries nothing: the outbox is the queue, and each run
 * drains whatever is due when it looks.
 */
const payload = z.object({});

/** Rows claimed per batch, bounding one loop iteration's work and locks. */
const CLAIM_BATCH_SIZE = 10;

/**
 * Seconds a claim lives without a result. Well above the send timeout, so a
 * live send never loses its claim mid-flight, and short enough that a runner
 * that died mid-batch frees its rows for the next drain.
 */
const CLAIM_LEASE_SECONDS = 120;

/**
 * Retention for accepted rows: a week covers any realistic troubleshooting
 * window, and deleting the row is what finally drops the template payload —
 * auth-link URL included — from the database.
 */
const ACCEPTED_RETENTION_SECONDS = 7 * 86_400;

/**
 * Retention for failed rows: a month, because a terminal failure is the only
 * record an operator has of a message that never went out.
 */
const FAILED_RETENTION_SECONDS = 30 * 86_400;

/** How one claimed row's delivery ended, as the loop acts on it. */
type DeliveryResult = "sent" | "failed" | "stop";

async function deliverOne(
	ctx: TaskContext,
	logger: Logger,
	claimToken: string,
	item: ClaimedEmail,
	state: EmailDeliveryState & { apiKey: string },
	signal: AbortSignal,
): Promise<DeliveryResult> {
	const target = { claimToken, outboxId: item.id };
	const template = item.template.type;

	const base = {
		outboxId: item.id,
		template,
		attempt: item.attemptCount,
	};

	let outcome: EmailSendOutcome;

	try {
		const rendered = renderEmailTemplate(item.template);

		outcome = await sendEmailViaResend({
			apiKey: state.apiKey,
			html: rendered.html,
			idempotencyKey: buildProviderIdempotencyKey(item.id, item.idempotencyKey),
			recipient: item.recipient,
			replyToAddress: state.settings.replyToAddress,
			senderAddress: state.settings.senderAddress,
			senderName: state.settings.senderName,
			signal,
			subject: rendered.subject,
			text: rendered.text,
		});
	} catch (err) {
		// Rendering is the only throw path: a payload that does not match its
		// template type. Deterministic, so a retry cannot fix it.
		await failEmail(ctx.db, target, "the template payload failed to render");
		ctx.emailMetrics.recordEmailAttempt(template, "permanent");
		logger.error({ ...base, err }, "email template failed to render");

		return "failed";
	}

	switch (outcome.outcome) {
		case "accepted": {
			const held = await markEmailAccepted(
				ctx.db,
				target,
				outcome.providerMessageId,
			);

			if (!held) {
				// The provider has the message either way; the idempotency key is
				// what keeps the new claim holder's send from duplicating it.
				logger.warn({ ...base }, "email claim lost before acceptance commit");

				return "sent";
			}

			ctx.emailMetrics.recordEmailAttempt(template, "accepted");
			ctx.emailMetrics.observeEmailAcceptedAge(
				(Date.now() - item.createdAt.getTime()) / 1000,
			);
			logger.info(
				{ ...base, providerMessageId: outcome.providerMessageId },
				"email accepted by provider",
			);

			return "sent";
		}

		case "configuration": {
			// The key stopped working mid-drain: an instance problem, not a
			// message problem. Hand the row back without burning an attempt slot's
			// backoff and stop the drain — every further send would fail the same
			// way.
			await releaseEmailClaim(ctx.db, target);
			ctx.emailMetrics.setEmailAvailability("configuration_error");
			logger.error(
				{ ...base },
				"email delivery stopped: the provider rejected the api key",
			);

			return "stop";
		}

		case "permanent": {
			await failEmail(ctx.db, target, outcome.error);
			ctx.emailMetrics.recordEmailAttempt(template, "permanent");
			logger.error({ ...base }, "email failed permanently");

			return "failed";
		}

		case "rate_limited":
		case "retryable": {
			if (item.attemptCount >= EMAIL_MAX_ATTEMPTS) {
				await failEmail(
					ctx.db,
					target,
					`retries exhausted after ${item.attemptCount} attempts: ${outcome.error}`,
				);
				ctx.emailMetrics.recordEmailAttempt(template, "exhausted");
				logger.error({ ...base }, "email failed terminally: retries exhausted");

				return "failed";
			}

			const delaySeconds = computeEmailRetryDelay(
				item.attemptCount,
				outcome.retryAfterSeconds,
			);

			await scheduleEmailRetry(ctx.db, target, delaySeconds, outcome.error);
			ctx.emailMetrics.recordEmailAttempt(template, outcome.outcome);
			ctx.emailMetrics.recordEmailRetryScheduled(template);
			logger.warn(
				{ ...base, outcome: outcome.outcome, delaySeconds },
				"email attempt failed, retry scheduled",
			);

			// Rate limiting is shared across every row this drain would send, so
			// pushing on would burn the whole batch's attempts against the same
			// window.
			return outcome.outcome === "rate_limited" ? "stop" : "failed";
		}
	}
}

/**
 * Drain due outbox rows through the provider, then prune terminal rows.
 *
 * Safe under reclaim by construction: enqueue is idempotent, claims are
 * fenced per row on a token this run mints, and the provider idempotency key
 * is deterministic per logical message — so a reclaimed run re-sends only
 * what the provider has not already accepted, and a fenced-out run cannot
 * commit results over the new holder's.
 *
 * Configuration is decrypted once per run, and only when delivery is enabled.
 * Any other availability updates the gauges and leaves every row untouched:
 * queued mail waits out a disabled or broken configuration rather than
 * burning attempts against it.
 */
export const deliverEmailTask = defineTask<typeof payload, TaskContext>({
	type: "deliver_email",
	payload,
	steps: ["deliver", "prune"],
	async run({ ctx, helpers, logger, signal }) {
		await helpers.runStep("deliver", async () => {
			const state = resolveEmailDelivery(
				await getEmailSettings(ctx.db),
				ctx.emailMasterKeys,
			);

			ctx.emailMetrics.setEmailAvailability(state.availability);

			if (state.availability === "configuration_error") {
				logger.error(
					{ availability: state.availability },
					"email delivery unavailable: stored api key cannot be decrypted",
				);
			}

			if (state.availability !== "ready" || state.apiKey === null) {
				ctx.emailMetrics.setEmailOutbox(await countEmailOutbox(ctx.db));

				return;
			}

			const claimToken = randomUUID();

			drain: while (!signal.aborted) {
				const batch = await claimDueEmails(ctx.db, {
					claimToken,
					leaseSeconds: CLAIM_LEASE_SECONDS,
					limit: CLAIM_BATCH_SIZE,
				});

				if (batch.length === 0) {
					break;
				}

				for (const item of batch) {
					if (signal.aborted) {
						break drain;
					}

					const result = await deliverOne(
						ctx,
						logger,
						claimToken,
						item,
						{ ...state, apiKey: state.apiKey },
						signal,
					);

					if (result === "stop") {
						break drain;
					}
				}
			}

			ctx.emailMetrics.setEmailOutbox(await countEmailOutbox(ctx.db));
		});

		await helpers.runStep("prune", async () => {
			const pruned = await pruneEmailOutbox(ctx.db, {
				acceptedSeconds: ACCEPTED_RETENTION_SECONDS,
				failedSeconds: FAILED_RETENTION_SECONDS,
			});

			if (pruned > 0) {
				logger.info({ count: pruned }, "pruned terminal email outbox rows");
			}
		});
	},
});
