import { createOutageRecovery, notifyOutage } from "@app/outage";
import { toast } from "@base/Toast/useToast";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { CLIENT_ERROR_NAME, UNAVAILABLE_MESSAGE } from "@virtool/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@base/Toast/useToast", () => ({ toast: vi.fn() }));

function unavailable(): Error {
	const error = Object.assign(
		new Error("Virtool is temporarily unavailable."),
		{
			status: 503,
		},
	);
	error.name = CLIENT_ERROR_NAME;
	return error;
}

// A mounted query is one with an observer, which is what an inline
// `QueryError` keeps while it shows.
async function observe(
	queryClient: QueryClient,
	queryFn: () => Promise<string>,
) {
	const observer = new QueryObserver(queryClient, {
		queryKey: ["labels"],
		queryFn,
		retry: false,
	});
	const unsubscribe = observer.subscribe(() => {});
	await vi.waitFor(() => {
		expect(observer.getCurrentResult().isFetching).toBe(false);
	});
	return { observer, unsubscribe };
}

describe("createOutageRecovery", () => {
	let queryClient: QueryClient;

	beforeEach(() => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		queryClient = new QueryClient();
	});

	afterEach(() => {
		queryClient.clear();
		vi.useRealTimers();
	});

	it("refetches a failed query until the service is back", async () => {
		const queryFn = vi
			.fn<() => Promise<string>>()
			.mockRejectedValueOnce(unavailable())
			.mockRejectedValueOnce(unavailable())
			.mockResolvedValue("labels");
		const { observer } = await observe(queryClient, queryFn);
		const recover = createOutageRecovery(queryClient);

		recover();
		await vi.advanceTimersByTimeAsync(5000);
		expect(queryFn).toHaveBeenCalledTimes(2);
		expect(observer.getCurrentResult().isError).toBe(true);

		await vi.advanceTimersByTimeAsync(5000);
		expect(queryFn).toHaveBeenCalledTimes(3);
		expect(observer.getCurrentResult().data).toBe("labels");

		await vi.advanceTimersByTimeAsync(20_000);
		expect(queryFn).toHaveBeenCalledTimes(3);
	});

	it("runs one loop however many queries report the outage", async () => {
		const queryFn = vi
			.fn<() => Promise<string>>()
			.mockRejectedValueOnce(unavailable())
			.mockResolvedValue("labels");
		await observe(queryClient, queryFn);
		const recover = createOutageRecovery(queryClient);

		recover();
		recover();
		recover();
		await vi.advanceTimersByTimeAsync(5000);

		expect(queryFn).toHaveBeenCalledTimes(2);
	});

	it("leaves unmounted and other failed queries alone", async () => {
		const failed = vi
			.fn<() => Promise<string>>()
			.mockRejectedValue(new Error("boom"));
		await observe(queryClient, failed);

		const unmounted = vi
			.fn<() => Promise<string>>()
			.mockRejectedValue(unavailable());
		await queryClient
			.fetchQuery({ queryKey: ["account"], queryFn: unmounted })
			.catch(() => {});

		createOutageRecovery(queryClient)();
		await vi.advanceTimersByTimeAsync(10_000);

		expect(failed).toHaveBeenCalledTimes(1);
		expect(unmounted).toHaveBeenCalledTimes(1);
	});
});

describe("notifyOutage", () => {
	it("replaces the last notice with a new one", () => {
		const first = { id: "1", dismiss: vi.fn(), update: vi.fn() };
		const second = { id: "2", dismiss: vi.fn(), update: vi.fn() };
		vi.mocked(toast).mockReturnValueOnce(first).mockReturnValueOnce(second);

		notifyOutage();
		notifyOutage();

		expect(toast).toHaveBeenCalledTimes(2);
		expect(toast).toHaveBeenCalledWith({ description: UNAVAILABLE_MESSAGE });
		expect(first.dismiss).toHaveBeenCalledOnce();
		expect(second.dismiss).not.toHaveBeenCalled();
	});
});
