import { z } from "zod";

/** The kind of backing source used by a v2 Reference. */
export const ReferenceV2Kind = {
	local: "local",
	remote: "remote",
} as const;

/** The kind of backing source used by a v2 Reference. */
export type ReferenceV2Kind =
	(typeof ReferenceV2Kind)[keyof typeof ReferenceV2Kind];

/** Fields accepted when creating a local v2 Reference. */
export const ReferenceV2CreateRequest = z
	.object({
		name: z.string().trim().min(1),
		description: z.string().trim().default(""),
		defaultSegmentLengthTolerance: z.number().min(0).max(1).default(0.05),
	})
	.strict();

/** Fields accepted when creating a local v2 Reference. */
export type ReferenceV2CreateRequest = z.infer<typeof ReferenceV2CreateRequest>;

/** A local v2 Reference as published by the server. */
export type ReferenceV2 = {
	id: string;
	name: string;
	description: string;
	kind: ReferenceV2Kind;
	defaultSegmentLengthTolerance: number;
	archived: boolean;
	createdAt: Date;
	updatedAt: Date;
};
