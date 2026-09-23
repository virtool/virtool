import { and, asc, eq, gt, isNull } from "drizzle-orm";
import type { Db } from "../db/pg";
import {
	otuIsolates,
	otuIsolateVersions,
	otuLocalSequenceRecords,
	otuSequences,
	otuSequenceVersions,
	otusV2,
} from "../db/schema/otusV2";

/** One current v2 sequence selected for a FASTA export. */
export type V2FastaSequence = {
	referenceId: string;
	otuId: string;
	isolateId: string;
	sequenceId: string;
	segmentId: string;
	source: "manual" | "genbank";
	accessionVersion: string | null;
	sequence: string;
};

/** A Reference, OTU, or isolate export scope. */
export type V2FastaScope = {
	referenceId: string;
	otuId?: string;
	isolateId?: string;
};

/** Whether a current OTU or isolate belongs to the requested Reference. */
export async function hasV2FastaScope(
	db: Db,
	scope: V2FastaScope,
): Promise<boolean> {
	if (!scope.otuId) {
		return true;
	}
	if (!scope.isolateId) {
		const rows = await db
			.select({ id: otusV2.id })
			.from(otusV2)
			.where(
				and(
					eq(otusV2.referenceId, scope.referenceId),
					eq(otusV2.id, scope.otuId),
					isNull(otusV2.ncbiFromVersion),
					isNull(otusV2.deletedVersion),
				),
			)
			.limit(1);
		return rows.length > 0;
	}
	const rows = await db
		.select({ id: otuIsolates.id })
		.from(otuIsolates)
		.innerJoin(otusV2, eq(otusV2.id, otuIsolates.otuId))
		.innerJoin(
			otuIsolateVersions,
			and(
				eq(otuIsolateVersions.otuId, otuIsolates.otuId),
				eq(otuIsolateVersions.isolateId, otuIsolates.id),
			),
		)
		.where(
			and(
				eq(otusV2.referenceId, scope.referenceId),
				eq(otusV2.id, scope.otuId),
				eq(otuIsolates.id, scope.isolateId),
				isNull(otusV2.ncbiFromVersion),
				isNull(otusV2.deletedVersion),
				isNull(otuIsolateVersions.lastVersion),
			),
		)
		.limit(1);
	return rows.length > 0;
}

/** Read one bounded page of current sequence bodies in stable sequence-id order. */
export async function getV2FastaPage(
	db: Db,
	scope: V2FastaScope,
	afterSequenceId: string | null,
	pageSize: number,
): Promise<V2FastaSequence[]> {
	const rows = await db
		.select({
			referenceId: otusV2.referenceId,
			otuId: otusV2.id,
			isolateId: otuSequenceVersions.isolateId,
			sequenceId: otuSequences.id,
			segmentId: otuSequenceVersions.segmentId,
			source: otuLocalSequenceRecords.source,
			accessionVersion: otuLocalSequenceRecords.accessionVersion,
			sequence: otuLocalSequenceRecords.sequence,
		})
		.from(otuSequences)
		.innerJoin(otusV2, eq(otusV2.id, otuSequences.otuId))
		.innerJoin(
			otuSequenceVersions,
			and(
				eq(otuSequenceVersions.otuId, otuSequences.otuId),
				eq(otuSequenceVersions.sequenceId, otuSequences.id),
			),
		)
		.innerJoin(
			otuIsolateVersions,
			and(
				eq(otuIsolateVersions.otuId, otuSequenceVersions.otuId),
				eq(otuIsolateVersions.isolateId, otuSequenceVersions.isolateId),
			),
		)
		.innerJoin(
			otuLocalSequenceRecords,
			eq(otuLocalSequenceRecords.id, otuSequenceVersions.localRecordId),
		)
		.where(
			and(
				eq(otusV2.referenceId, scope.referenceId),
				scope.otuId ? eq(otusV2.id, scope.otuId) : undefined,
				scope.isolateId
					? eq(otuSequenceVersions.isolateId, scope.isolateId)
					: undefined,
				afterSequenceId ? gt(otuSequences.id, afterSequenceId) : undefined,
				isNull(otusV2.deletedVersion),
				isNull(otusV2.ncbiFromVersion),
				isNull(otuSequenceVersions.lastVersion),
				isNull(otuIsolateVersions.lastVersion),
			),
		)
		.orderBy(asc(otuSequences.id))
		.limit(pageSize);
	return rows;
}
