import { createLogger } from "@virtool/logger";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSentryLogStream } from "./log";

const sentry = {
	trace: vi.fn(),
	debug: vi.fn(),
	info: vi.fn(),
	warn: vi.fn(),
	error: vi.fn(),
	fatal: vi.fn(),
};

describe("createSentryLogStream", () => {
	beforeEach(() => {
		for (const fn of Object.values(sentry)) {
			fn.mockClear();
		}
	});

	it("forwards a record to the Sentry method matching its level", () => {
		const stream = createSentryLogStream(sentry);

		stream.write(`${JSON.stringify({ level: 40, msg: "watch out" })}\n`);

		expect(sentry.warn).toHaveBeenCalledTimes(1);
		expect(sentry.warn).toHaveBeenCalledWith("watch out", expect.anything());
	});

	it("passes structured fields as attributes and drops the pino envelope", () => {
		const stream = createSentryLogStream(sentry);

		stream.write(
			`${JSON.stringify({
				level: 30,
				time: 123,
				pid: 1,
				hostname: "h",
				name: "web",
				msg: "login",
				userId: "u1",
			})}\n`,
		);

		expect(sentry.info).toHaveBeenCalledWith("login", { userId: "u1" });
	});

	it("forwards already-redacted secret fields from a real logger", () => {
		const stream = createSentryLogStream(sentry);
		const log = createLogger({
			name: "web",
			level: "info",
			destination: { write() {} },
			streams: [{ level: "info", stream }],
		});

		log.info({ password: "hunter2", headers: { cookie: "s=1" } }, "sign in");

		expect(sentry.info).toHaveBeenCalledWith(
			"sign in",
			expect.objectContaining({
				password: "[redacted]",
				headers: { cookie: "[redacted]" },
			}),
		);
	});

	it("ignores malformed lines", () => {
		const stream = createSentryLogStream(sentry);

		expect(() => stream.write("not json\n")).not.toThrow();
		for (const fn of Object.values(sentry)) {
			expect(fn).not.toHaveBeenCalled();
		}
	});
});
