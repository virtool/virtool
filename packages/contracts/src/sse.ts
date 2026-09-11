import { z } from "zod";

const OperationSchema = z.enum(["insert", "update", "delete"]);

function frame<D extends string, I extends z.ZodTypeAny>(domain: D, id: I) {
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
	frame("banners", NumberId),
	frame("groups", NumberId),
	frame("indexes", NumberId),
	frame("jobs", NumberId),
	frame("labels", NumberId),
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

/** Domains that may appear on the server-push SSE stream. */
export const SseDomainSchema = z.enum(
	SseMessageSchema.options.map(function getDomain(schema) {
		return schema.shape.domain.value;
	}),
);

/** Domain literal as a TypeScript union. */
export type SseDomain = SseMessage["domain"];
