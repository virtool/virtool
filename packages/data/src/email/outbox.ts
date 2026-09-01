// The durable email outbox.
//
// Enqueue is idempotent on a caller-supplied domain key and transaction-
// compatible, so auth state and its email commit together. Claiming hands
// bounded batches to exactly one holder at a time, and every result write is
// fenced on the claim token, so a runner that lost its claim cannot commit a
// send result over the new holder's.

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

/**
 * Queue one logical message, or return the row an earlier enqueue created.
 *
 * `DbOrTx` so a caller can insert atomically with the domain state the email
 * announces. The conflict target is the unique domain idempotency key;
 * `onConflictDoNothing` plus the follow-up read is what makes a duplicate —
 * concurrent included — resolve to the existing row rather than a second
 * message.
 */
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

/**
 * Match a row that is due and that no live claim holds.
 *
 * A claim is live while `claim_expires_at` is in the future; an expired one is
 * a runner that died mid-send, and the row is claimable again — which is the
 * reclaim path, so there is deliberately no attempt-count guard here.
 */
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
 * The candidate ids are read under `FOR UPDATE SKIP LOCKED` and **materialised
 * into the update as literals**, in one transaction that holds the row locks
 * across both statements. An inlined subquery is not an option here: `isDue`
 * carries `clock_timestamp()`, which is volatile, so the planner re-executes
 * the subquery per candidate row — and each re-execution takes a fresh
 * LIMIT-sized window past the rows the statement already claimed, claiming a
 * rolling multiple of the batch size.
 *
 * `SKIP LOCKED` is what keeps concurrent claimers on disjoint batches, and the
 * held locks are what make the repeated `isDue` on the update a formality
 * rather than a race.
 *
 * The attempt increments at claim rather than at result, so an attempt whose
 * outcome is never learned — process death mid-send — still counts against the
 * bound. Resend's idempotency key is what keeps such an ambiguous attempt from
 * becoming a duplicate message.
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

/**
 * The fencing guard every result write carries.
 *
 * A write matches only while the row is still queued and still carries this
 * claim's token, so a claim that expired and was retaken elsewhere makes the
 * stale holder's write a no-op rather than an overwrite.
 */
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

/**
 * Record that the provider accepted the message.
 *
 * Acceptance is the provider taking responsibility for the message, not proof
 * it reached a mailbox. Returns `false` when the claim was lost, in which case
 * nothing was written.
 */
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

/**
 * Schedule the next attempt after a retryable failure, releasing the claim.
 *
 * Returns `false` when the claim was lost.
 */
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

/**
 * Mark the row terminally failed, preserving `error` for operator visibility.
 *
 * Returns `false` when the claim was lost.
 */
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

/**
 * Release one claimed row without recording a result, leaving it due.
 *
 * The path for an outcome that says nothing about the message — the API key
 * stopped working mid-drain — where burning a retry slot or a backoff delay
 * would punish the row for a configuration problem. Because claiming
 * increments the attempt count, releasing also restores that increment.
 */
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

/**
 * Delete terminal rows older than their retention window.
 *
 * Accepted rows age out faster than failed ones: a failed row is the only
 * record an operator has of a message that never went out, while an accepted
 * row's job is done once troubleshooting windows have passed. Deleting a row
 * also deletes its template payload, which is what bounds how long an
 * auth-link token can sit in this table.
 */
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
