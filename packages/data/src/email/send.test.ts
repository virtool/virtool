import { afterEach, describe, expect, it, vi } from "vitest";
import { buildProviderIdempotencyKey, sendEmailViaResend } from "./send";

/** The base request every test sends, minus whatever it overrides. */
const request = {
	apiKey: "re_test_key",
	html: "<p>hello</p>",
	idempotencyKey: "outbox/1/abc",
	recipient: "someone@example.com",
	replyToAddress: "",
	senderAddress: "noreply@virtool.example",
	senderName: "Virtool",
	subject: "hello",
	text: "hello",
};

function jsonResponse(
	status: number,
	body: unknown,
	headers: Record<string, string> = {},
): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json", ...headers },
	});
}

function stubFetch(response: Response | Promise<Response>) {
	const fetchMock = vi.fn().mockReturnValue(Promise.resolve(response));
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("buildProviderIdempotencyKey", () => {
	it("is deterministic for the same row and domain key", () => {
		expect(buildProviderIdempotencyKey(7, "verify/3/9")).toBe(
			buildProviderIdempotencyKey(7, "verify/3/9"),
		);
	});

	it("differs by row and by domain key", () => {
		expect(buildProviderIdempotencyKey(7, "a")).not.toBe(
			buildProviderIdempotencyKey(8, "a"),
		);
		expect(buildProviderIdempotencyKey(7, "a")).not.toBe(
			buildProviderIdempotencyKey(7, "b"),
		);
	});

	it("stays under the provider's 256-character limit for a long domain key", () => {
		expect(
			buildProviderIdempotencyKey(2_147_483_647, "x".repeat(4096)).length,
		).toBeLessThanOrEqual(256);
	});
});

describe("sendEmailViaResend", () => {
	it("reports acceptance with the provider message id", async () => {
		const fetchMock = stubFetch(jsonResponse(200, { id: "msg_1" }));

		await expect(sendEmailViaResend(request)).resolves.toEqual({
			outcome: "accepted",
			providerMessageId: "msg_1",
		});

		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

		expect(url).toContain("https://api.resend.com/emails");
		expect(new Headers(init.headers).get("Idempotency-Key")).toBe(
			"outbox/1/abc",
		);
		expect(new Headers(init.headers).get("Authorization")).toBe(
			"Bearer re_test_key",
		);
		expect(init.signal).toBeInstanceOf(AbortSignal);

		const body = JSON.parse(init.body as string);
		expect(body.from).toBe("Virtool <noreply@virtool.example>");
		expect(body.to).toEqual(["someone@example.com"]);
		expect(body.reply_to).toBeUndefined();
	});

	it("sends a bare address when no sender name is set, and a replyTo when one is", async () => {
		const fetchMock = stubFetch(jsonResponse(200, { id: "msg_1" }));

		await sendEmailViaResend({
			...request,
			senderName: "",
			replyToAddress: "support@virtool.example",
		});

		const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		const body = JSON.parse(init.body as string);

		expect(body.from).toBe("noreply@virtool.example");
		expect(body.reply_to).toBe("support@virtool.example");
	});

	it("classifies an invalid API key as a configuration outcome", async () => {
		stubFetch(
			jsonResponse(401, {
				name: "invalid_api_key",
				message: "API key is invalid",
				statusCode: 401,
			}),
		);

		const outcome = await sendEmailViaResend(request);

		expect(outcome.outcome).toBe("configuration");
	});

	it("classifies a rate limit with its retry guidance", async () => {
		stubFetch(
			jsonResponse(
				429,
				{
					name: "rate_limit_exceeded",
					message: "Too many requests",
					statusCode: 429,
				},
				{ "retry-after": "12" },
			),
		);

		await expect(sendEmailViaResend(request)).resolves.toEqual({
			outcome: "rate_limited",
			error: expect.stringContaining("rate_limit_exceeded"),
			retryAfterSeconds: 12,
		});
	});

	it("classifies a validation failure as permanent", async () => {
		stubFetch(
			jsonResponse(422, {
				name: "validation_error",
				message: "Invalid `to` field",
				statusCode: 422,
			}),
		);

		const outcome = await sendEmailViaResend(request);

		expect(outcome.outcome).toBe("permanent");
	});

	it("classifies a provider 500 as retryable", async () => {
		stubFetch(
			jsonResponse(500, {
				name: "internal_server_error",
				message: "boom",
				statusCode: 500,
			}),
		);

		const outcome = await sendEmailViaResend(request);

		expect(outcome.outcome).toBe("retryable");
	});

	it("classifies an unknown 5xx error name as retryable and an unknown 4xx as permanent", async () => {
		stubFetch(
			jsonResponse(503, {
				name: "brand_new_error",
				message: "??",
				statusCode: 503,
			}),
		);
		expect((await sendEmailViaResend(request)).outcome).toBe("retryable");

		stubFetch(
			jsonResponse(400, {
				name: "brand_new_error",
				message: "??",
				statusCode: 400,
			}),
		);
		expect((await sendEmailViaResend(request)).outcome).toBe("permanent");
	});

	it("classifies a network failure as retryable without throwing", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockRejectedValue(new TypeError("fetch failed")),
		);

		const outcome = await sendEmailViaResend(request);

		expect(outcome.outcome).toBe("retryable");
	});

	it("aborts through the caller's signal and reports it as retryable", async () => {
		const controller = new AbortController();

		vi.stubGlobal(
			"fetch",
			vi.fn().mockImplementation((_url, init: RequestInit) => {
				return new Promise((_resolve, reject) => {
					init.signal?.addEventListener("abort", () =>
						reject(new DOMException("aborted", "AbortError")),
					);
				});
			}),
		);

		const pending = sendEmailViaResend({
			...request,
			signal: controller.signal,
		});

		controller.abort();

		const outcome = await pending;

		expect(outcome.outcome).toBe("retryable");
	});

	it("never puts the API key in an outcome's error text", async () => {
		stubFetch(
			jsonResponse(401, {
				name: "invalid_api_key",
				message: "API key is invalid",
				statusCode: 401,
			}),
		);

		const outcome = await sendEmailViaResend(request);

		expect(JSON.stringify(outcome)).not.toContain("re_test_key");
	});
});
