import type { EmailTemplate } from "@virtool/contracts";
import {
	and,
	asc,
	eq,
	inArray,
	isNull,
	lt,
	or,
	type SQL,
	sql,
} from "drizzle-orm";
import type { Db, DbOrTx } from "../db/pg";
import { takeFirst, takeFirstOrThrow } from "../db/rows";
import { emailOutbox } from "../db/schema/emailOutbox";
import { nowUtc, secondsAgo } from "../db/time";
import { EMAIL_TEMPLATE_VERSION } from "./templates";

/** What {@link enqueueEmail} needs to queue one logical message. */
export type EnqueueEmailInput = {
	/**
	 * A stable domain key, e.g. `email_verification/{userId}/{tokenId}`.
	 * Duplicate enqueues under the same key return the existing row.
	 */
	idempotencyKey: string;
	/** Do not attempt delivery before this time. Defaults to now. */
	notBefore?: Date;
	recipient: string;
	template: EmailTemplate;
};

/** What {@link enqueueEmail} returns: the row's identity and whether it is new. */
export type EnqueueEmailResult = {
	created: boolean;
	outboxId: number;
};

/** Queue one message, returning the existing row for a duplicate key. */
export async function enqueueEmail(
	db: DbOrTx,
	input: EnqueueEmailInput,
): Promise<EnqueueEmailResult> {
	const inserted = takeFirst(
		await db
			.insert(emailOutbox)
			.values({
				attempt_count: 0,
				created_at: nowUtc(),
				idempotency_key: input.idempotencyKey,
				next_attempt_at: input.notBefore ?? nowUtc(),
				recipient: input.recipient,
				status: "queued",
				template: input.template,
				template_version: EMAIL_TEMPLATE_VERSION,
			})
			.onConflictDoNothing({ target: emailOutbox.idempotency_key })
			.returning({ id: emailOutbox.id }),
	);

	if (inserted) {
		return { created: true, outboxId: inserted.id };
	}

	const existing = takeFirstOrThrow(
		await db
			.select({ id: emailOutbox.id })
			.from(emailOutbox)
			.where(eq(emailOutbox.idempotency_key, input.idempotencyKey)),
	);

	return { created: false, outboxId: existing.id };
}

/** A row handed to the delivery loop by {@link claimDueEmails}. */
export type ClaimedEmail = {
	/** Including the attempt this claim just started. */
	attemptCount: number;
	createdAt: Date;
	id: number;
	idempotencyKey: string;
	recipient: string;
	template: EmailTemplate;
	templateVersion: number;
};

/** What {@link claimDueEmails} needs to take a batch. */
export type ClaimDueEmailsOptions = {
	/** Fences every result write for the rows this call returns. */
	claimToken: string;
	leaseSeconds: number;
	limit: number;
};

function isDue(): SQL | undefined {
	return and(
		eq(emailOutbox.status, "queued"),
		lt(emailOutbox.next_attempt_at, nowUtc()),
		or(
			isNull(emailOutbox.claim_expires_at),
			lt(emailOutbox.claim_expires_at, nowUtc()),
		),
	);
}

/**
 * Claim up to `limit` due rows for `claimToken`, incrementing each row's
 * attempt count.
 *
 * Candidate IDs are materialized before the update because an inline query
 * containing `clock_timestamp()` can be re-evaluated and exceed the limit.
 * Row locks and `SKIP LOCKED` keep concurrent claimers on separate batches.
 */
export async function claimDueEmails(
	db: Db,
	options: ClaimDueEmailsOptions,
): Promise<ClaimedEmail[]> {
	const rows = await db.transaction(async (tx) => {
		const candidates = await tx
			.select({ id: emailOutbox.id })
			.from(emailOutbox)
			.where(isDue())
			.orderBy(asc(emailOutbox.next_attempt_at))
			.limit(options.limit)
			.for("update", { skipLocked: true });

		if (candidates.length === 0) {
			return [];
		}

		return tx
			.update(emailOutbox)
			.set({
				attempt_count: sql`${emailOutbox.attempt_count} + 1`,
				claim_expires_at: sql`${nowUtc()} + make_interval(secs => ${options.leaseSeconds}::double precision)`,
				claim_token: options.claimToken,
			})
			.where(
				and(
					inArray(
						emailOutbox.id,
						candidates.map(({ id }) => id),
					),
					isDue(),
				),
			)
			.returning({
				attemptCount: emailOutbox.attempt_count,
				createdAt: emailOutbox.created_at,
				id: emailOutbox.id,
				idempotencyKey: emailOutbox.idempotency_key,
				recipient: emailOutbox.recipient,
				template: emailOutbox.template,
				templateVersion: emailOutbox.template_version,
			});
	});

	return rows.map((row) => ({
		attemptCount: row.attemptCount,
		createdAt: row.createdAt,
		id: row.id,
		idempotencyKey: row.idempotencyKey,
		recipient: row.recipient,
		template: row.template,
		templateVersion: row.templateVersion,
	}));
}

/** Match a queued row only while the caller still holds its claim. */
function isHeld(outboxId: number, claimToken: string): SQL | undefined {
	return and(
		eq(emailOutbox.id, outboxId),
		eq(emailOutbox.claim_token, claimToken),
		eq(emailOutbox.status, "queued"),
	);
}

/** What a result write needs to identify and fence itself. */
export type EmailResultTarget = {
	claimToken: string;
	outboxId: number;
};

/** Record provider acceptance, or return `false` if the claim was lost. */
export async function markEmailAccepted(
	db: Db,
	target: EmailResultTarget,
	providerMessageId: string,
): Promise<boolean> {
	const rows = await db
		.update(emailOutbox)
		.set({
			accepted_at: nowUtc(),
			claim_expires_at: null,
			claim_token: null,
			last_error: null,
			provider_message_id: providerMessageId,
			status: "accepted",
			terminal_at: nowUtc(),
		})
		.where(isHeld(target.outboxId, target.claimToken))
		.returning({ id: emailOutbox.id });

	return rows.length > 0;
}

/** Schedule a retry, or return `false` if the claim was lost. */
export async function scheduleEmailRetry(
	db: Db,
	target: EmailResultTarget,
	retryDelaySeconds: number,
	error: string,
): Promise<boolean> {
	const rows = await db
		.update(emailOutbox)
		.set({
			claim_expires_at: null,
			claim_token: null,
			last_error: error,
			next_attempt_at: sql`${nowUtc()} + make_interval(secs => ${retryDelaySeconds}::double precision)`,
		})
		.where(isHeld(target.outboxId, target.claimToken))
		.returning({ id: emailOutbox.id });

	return rows.length > 0;
}

/** Mark a row failed, or return `false` if the claim was lost. */
export async function failEmail(
	db: Db,
	target: EmailResultTarget,
	error: string,
): Promise<boolean> {
	const rows = await db
		.update(emailOutbox)
		.set({
			claim_expires_at: null,
			claim_token: null,
			last_error: error,
			status: "failed",
			terminal_at: nowUtc(),
		})
		.where(isHeld(target.outboxId, target.claimToken))
		.returning({ id: emailOutbox.id });

	return rows.length > 0;
}

/** Release a claim and undo its attempt increment. */
export async function releaseEmailClaim(
	db: Db,
	target: EmailResultTarget,
): Promise<boolean> {
	const rows = await db
		.update(emailOutbox)
		.set({
			attempt_count: sql`${emailOutbox.attempt_count} - 1`,
			claim_expires_at: null,
			claim_token: null,
		})
		.where(isHeld(target.outboxId, target.claimToken))
		.returning({ id: emailOutbox.id });

	return rows.length > 0;
}

/** The outbox split by state, as a metrics gauge reports it. */
export type EmailOutboxCounts = {
	accepted: number;
	failed: number;
	/** Queued rows a live claim currently holds. */
	inFlight: number;
	/** Queued rows no live claim holds. */
	queued: number;
};

/** Count every outbox row by state, splitting queued rows on claim liveness. */
export async function countEmailOutbox(db: Db): Promise<EmailOutboxCounts> {
	const row = takeFirstOrThrow(
		await db
			.select({
				accepted: sql<number>`
					count(*) filter (where ${emailOutbox.status} = 'accepted')
				`.mapWith(Number),
				failed: sql<number>`
					count(*) filter (where ${emailOutbox.status} = 'failed')
				`.mapWith(Number),
				inFlight: sql<number>`
					count(*) filter (where ${emailOutbox.status} = 'queued' and ${emailOutbox.claim_expires_at} > ${nowUtc()})
				`.mapWith(Number),
				queued: sql<number>`
					count(*) filter (where ${emailOutbox.status} = 'queued' and (${emailOutbox.claim_expires_at} is null or ${emailOutbox.claim_expires_at} <= ${nowUtc()}))
				`.mapWith(Number),
			})
			.from(emailOutbox),
	);

	return row;
}

/** Retention windows for {@link pruneEmailOutbox}. */
export type EmailRetention = {
	acceptedSeconds: number;
	failedSeconds: number;
};

/** Delete terminal rows older than their retention window. */
export async function pruneEmailOutbox(
	db: Db,
	retention: EmailRetention,
): Promise<number> {
	const rows = await db
		.delete(emailOutbox)
		.where(
			or(
				and(
					eq(emailOutbox.status, "accepted"),
					lt(emailOutbox.terminal_at, secondsAgo(retention.acceptedSeconds)),
				),
				and(
					eq(emailOutbox.status, "failed"),
					lt(emailOutbox.terminal_at, secondsAgo(retention.failedSeconds)),
				),
			),
		)
		.returning({ id: emailOutbox.id });

	return rows.length;
}
