import { z } from "zod";

/** Domains that may appear on the server-push SSE stream. */
export const SseDomainSchema = z.enum([
	"account",
	"analyses",
	"groups",
	"indexes",
	"jobs",
	"labels",
	"messages",
	"references",
	"roles",
	"samples",
	"subtractions",
	"tasks",
	"uploads",
	"users",
]);

/** Domain literal as a TypeScript union. */
export type SseDomain = z.infer<typeof SseDomainSchema>;

const OperationSchema = z.enum(["insert", "update", "delete"]);

function frame<D extends SseDomain, I extends z.ZodTypeAny>(domain: D, id: I) {
	return z
		.object({
			domain: z.literal(domain),
			operation: OperationSchema,
			id,
		})
		.strip();
}

const NumberId = z.number();
const StringId = z.string();

export const SseMessageSchema = z.discriminatedUnion("domain", [
	frame("account", NumberId),
	frame("analyses", NumberId),
	frame("groups", NumberId),
	frame("indexes", NumberId),
	frame("jobs", NumberId),
	frame("labels", NumberId),
	frame("messages", NumberId),
	frame("references", NumberId),
	frame("roles", StringId),
	frame("samples", NumberId),
	frame("subtractions", NumberId),
	frame("tasks", NumberId),
	frame("uploads", NumberId),
	frame("users", NumberId),
]);

/** A server-push frame, validated and discriminated by domain. */
export type SseMessage = z.infer<typeof SseMessageSchema>;
