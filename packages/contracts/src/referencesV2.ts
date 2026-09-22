import { z } from "zod";

/** The per-reference rights granted to a v2 Reference member. */
export type ReferenceV2Rights = {
	publishVersion: boolean;
	modify: boolean;
	modifyOtu: boolean;
};

/** The name of a single v2 Reference right. */
export type ReferenceV2Right = keyof ReferenceV2Rights;

/** A user granted rights on a v2 Reference. */
export type ReferenceV2User = ReferenceV2Rights & {
	id: number;
	handle: string;
};

/** A group granted rights on a v2 Reference. */
export type ReferenceV2Group = ReferenceV2Rights & {
	id: number;
	name: string;
};

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

/** A versioned update to editable local Reference metadata. */
export const ReferenceV2UpdateRequest = z
	.object({
		name: z.string().trim().min(1),
		description: z.string().trim(),
		defaultSegmentLengthTolerance: z.number().min(0).max(1),
		expectedVersion: z.number().int().positive(),
	})
	.strict();

/** A versioned update to editable local Reference metadata. */
export type ReferenceV2UpdateRequest = z.infer<typeof ReferenceV2UpdateRequest>;

/** A local v2 Reference as published by the server. */
export type ReferenceV2 = {
	id: string;
	version: number;
	name: string;
	description: string;
	kind: ReferenceV2Kind;
	defaultSegmentLengthTolerance: number;
	archived: boolean;
	createdAt: Date;
	updatedAt: Date;
	users: ReferenceV2User[];
	groups: ReferenceV2Group[];
};
