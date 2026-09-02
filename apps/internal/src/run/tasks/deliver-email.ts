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
	getEmailDeliveryRemainingSeconds,
	isEmailDeliveryExpired,
} from "@virtool/data/email/retry";
import {
	buildProviderIdempotencyKey,
	EMAIL_SEND_TIMEOUT_MS,
	type EmailSendOutcome,
	sendEmailViaResend,
} from "@virtool/data/email/send";
import {
	type EmailDeliveryState,
	getEmailSettings,
	resolveEmailDelivery,
} from "@virtool/data/email/settings";
import {
	EMAIL_TEMPLATE_VERSION,
	renderEmailTemplate,
} from "@virtool/data/email/templates";
import type { Logger } from "@virtool/logger";
import { z } from "zod";
import { defineTask } from "../framework/define";
import type { TaskContext } from "./registry";

const payload = z.object({});

/** How many due rows one claim takes. */
export const CLAIM_BATCH_SIZE = 10;

/**
 * Extra lease time over the worst-case batch, covering the render, the claim
 * itself, and the result write around each send. Thirty seconds is three
 * database round trips per row for a full batch, with room to spare.
 */
const CLAIM_LEASE_SLACK_SECONDS = 30;

/**
 * How long a claim holds its batch.
 *
 * A batch is sent one row at a time, so the lease has to outlast every row in
 * it reaching {@link EMAIL_SEND_TIMEOUT_MS}. Deriving it from the batch size
 * and the send timeout keeps the three in agreement when any one of them
 * changes. A shorter lease lets a second run re-claim rows the first run is
 * still sending: the message goes twice, and the first run's fenced result
 * write finds no claim and silently does nothing.
 */
export const CLAIM_LEASE_SECONDS =
	CLAIM_BATCH_SIZE * (EMAIL_SEND_TIMEOUT_MS / 1000) + CLAIM_LEASE_SLACK_SECONDS;

/**
 * How long one run keeps claiming new batches.
 *
 * The budget plus the batch in flight when it passes plus the prune step stay
 * well inside `TASK_WEDGE_SECONDS`, past which an unfinished `deliver_email`
 * row stops suppressing new ones and a second run can exist at all. The type
 * spawns every 30 s, so a backlog this defers waits seconds for the next run.
 */
export const RUN_BUDGET_MS = 300_000;

const ACCEPTED_RETENTION_SECONDS = 7 * 86_400;
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

	if (item.templateVersion !== EMAIL_TEMPLATE_VERSION) {
		await failEmail(
			ctx.db,
			target,
			`unsupported email template version: ${item.templateVersion}`,
		);
		ctx.metrics.recordEmailAttempt(template, "permanent");
		logger.error(
			{ ...base, templateVersion: item.templateVersion },
			"email template version is unsupported",
		);

		return "failed";
	}

	let outcome: EmailSendOutcome;

	try {
		const rendered = renderEmailTemplate(item.template);

		outcome = await sendEmailViaResend({
			apiKey: state.apiKey,
			html: rendered.html,
			idempotencyKey: buildProviderIdempotencyKey(
				item.id,
				item.idempotencyKey,
				state.settings,
			),
			recipient: item.recipient,
			replyToAddress: state.settings.replyToAddress,
			senderAddress: state.settings.senderAddress,
			senderName: state.settings.senderName,
			signal,
			subject: rendered.subject,
			text: rendered.text,
		});
	} catch (err) {
		await failEmail(ctx.db, target, "the template payload failed to render");
		ctx.metrics.recordEmailAttempt(template, "permanent");
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
				logger.warn({ ...base }, "email claim lost before acceptance commit");

				return "sent";
			}

			ctx.metrics.recordEmailAttempt(template, "accepted");
			ctx.metrics.observeEmailAcceptedAge(
				(Date.now() - item.createdAt.getTime()) / 1000,
			);
			logger.info(
				{ ...base, providerMessageId: outcome.providerMessageId },
				"email accepted by provider",
			);

			return "sent";
		}

		case "configuration": {
			await releaseEmailClaim(ctx.db, target);
			ctx.metrics.setEmailAvailability("configuration_error");
			logger.error(
				{ ...base },
				"email delivery stopped: the provider rejected the api key",
			);

			return "stop";
		}

		case "permanent": {
			await failEmail(ctx.db, target, outcome.error);
			ctx.metrics.recordEmailAttempt(template, "permanent");
			logger.error({ ...base }, "email failed permanently");

			return "failed";
		}

		case "rate_limited":
		case "retryable": {
			const drainResult =
				outcome.outcome === "rate_limited" ? "stop" : "failed";

			if (isEmailDeliveryExpired(item.createdAt)) {
				await failEmail(
					ctx.db,
					target,
					`delivery deadline passed after ${item.attemptCount} attempts: ${outcome.error}`,
				);
				ctx.metrics.recordEmailAttempt(template, "expired");
				logger.error(
					{ ...base },
					"email failed terminally: delivery deadline passed",
				);

				return drainResult;
			}

			if (item.attemptCount >= EMAIL_MAX_ATTEMPTS) {
				await failEmail(
					ctx.db,
					target,
					`retries exhausted after ${item.attemptCount} attempts: ${outcome.error}`,
				);
				ctx.metrics.recordEmailAttempt(template, "exhausted");
				logger.error({ ...base }, "email failed terminally: retries exhausted");

				return drainResult;
			}

			// A long provider `Retry-After` can reach past the deadline. Waking at
			// the deadline instead fails the row then, rather than leaving it
			// counted as queued for hours after it is already dead.
			const delaySeconds = Math.min(
				computeEmailRetryDelay(item.attemptCount, outcome.retryAfterSeconds),
				Math.ceil(getEmailDeliveryRemainingSeconds(item.createdAt)),
			);

			await scheduleEmailRetry(ctx.db, target, delaySeconds, outcome.error);
			ctx.metrics.recordEmailAttempt(template, outcome.outcome);
			ctx.metrics.recordEmailRetryScheduled(template);
			logger.warn(
				{ ...base, outcome: outcome.outcome, delaySeconds },
				"email attempt failed, retry scheduled",
			);

			return drainResult;
		}
	}
}

/** Deliver due email and prune terminal outbox rows. */
export const deliverEmailTask = defineTask<typeof payload, TaskContext>({
	type: "deliver_email",
	payload,
	steps: ["deliver", "prune"],
	async run({ ctx, helpers, logger, signal }) {
		await helpers.runStep("deliver", async () => {
			const state = resolveEmailDelivery(
				await getEmailSettings(ctx.db),
				ctx.keyring,
			);

			ctx.metrics.setEmailAvailability(state.availability);

			if (state.availability === "configuration_error") {
				logger.error(
					{ availability: state.availability },
					"email delivery unavailable: stored api key cannot be decrypted",
				);
			}

			if (state.availability !== "ready" || state.apiKey === null) {
				ctx.metrics.setEmailOutbox(await countEmailOutbox(ctx.db));

				return;
			}

			const claimToken = randomUUID();
			const startedAt = performance.now();

			let budgetPassed = false;

			drain: while (!signal.aborted) {
				if (performance.now() - startedAt >= RUN_BUDGET_MS) {
					budgetPassed = true;
					break;
				}

				const batch = await claimDueEmails(ctx.db, {
					claimToken,
					leaseSeconds: CLAIM_LEASE_SECONDS,
					limit: CLAIM_BATCH_SIZE,
				});

				if (batch.length === 0) {
					break;
				}

				for (const [index, item] of batch.entries()) {
					if (signal.aborted) {
						await Promise.all(
							batch.slice(index).map((unprocessed) =>
								releaseEmailClaim(ctx.db, {
									claimToken,
									outboxId: unprocessed.id,
								}),
							),
						);
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
						await Promise.all(
							batch.slice(index + 1).map((unprocessed) =>
								releaseEmailClaim(ctx.db, {
									claimToken,
									outboxId: unprocessed.id,
								}),
							),
						);
						break drain;
					}
				}
			}

			const counts = await countEmailOutbox(ctx.db);

			ctx.metrics.setEmailOutbox(counts);

			if (budgetPassed && counts.queued > 0) {
				logger.info(
					{ queued: counts.queued, budgetMs: RUN_BUDGET_MS },
					"email delivery stopped at its run budget, the next run continues",
				);
			}
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
