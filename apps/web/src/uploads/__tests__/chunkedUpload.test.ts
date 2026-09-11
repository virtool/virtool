import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { uploadServerFnMocks } from "../../tests/server-fn/uploads";
import { type ChunkedInit, uploadBlocks } from "../chunkedUpload";

// The status a request settles with, chosen from its URL so a test can fail
// just the block PUTs while the commit and everything else succeed.
let statusFor: (url: string) => number;

// Every request the run made, in creation order.
let requests: MockXhr[];
let settleBlocksAutomatically: boolean;
let activeBlocks: number;
let maxActiveBlocks: number;

// A mock XHR that settles itself on the next microtask, so the concurrent block
// uploads run to completion without a test driving each one by hand.
class MockXhr {
	status = 0;
	responseText = "";
	method = "";
	url = "";
	body: unknown;
	aborted = false;
	upload = new EventTarget();
	private events = new EventTarget();
	private settled = false;

	constructor() {
		requests.push(this);
	}

	open(method: string, url: string): void {
		this.method = method;
		this.url = url;
	}

	setRequestHeader(): void {}

	send(body: unknown): void {
		this.body = body;
		if (this.url.includes("comp=block&")) {
			activeBlocks++;
			maxActiveBlocks = Math.max(maxActiveBlocks, activeBlocks);
			if (!settleBlocksAutomatically) {
				return;
			}
		}
		queueMicrotask(() => {
			this.respond();
		});
	}

	addEventListener(type: string, listener: EventListener): void {
		this.events.addEventListener(type, listener);
	}

	abort(): void {
		if (this.settled) {
			return;
		}
		this.aborted = true;
		this.settled = true;
		if (this.url.includes("comp=block&")) {
			activeBlocks--;
		}
		this.events.dispatchEvent(new Event("abort"));
	}

	respond(): void {
		if (this.aborted || this.settled) {
			return;
		}
		this.settled = true;
		if (this.url.includes("comp=block&")) {
			activeBlocks--;
		}
		this.status = statusFor(this.url);
		this.events.dispatchEvent(new Event("load"));
	}
}

function init(overrides: Partial<ChunkedInit> = {}): ChunkedInit {
	return {
		uploadId: 7,
		url: "https://fd/c/blob?sig=x",
		blockSize: 4,
		concurrency: 4,
		...overrides,
	};
}

function blockRequests(): MockXhr[] {
	return requests.filter((request) => request.url.includes("comp=block&"));
}

function blockListRequest(): MockXhr | undefined {
	return requests.find((request) => request.url.includes("comp=blocklist"));
}

beforeEach(() => {
	requests = [];
	settleBlocksAutomatically = true;
	activeBlocks = 0;
	maxActiveBlocks = 0;
	statusFor = () => 201;
	vi.stubGlobal("XMLHttpRequest", function XMLHttpRequestStub() {
		return new MockXhr();
	});
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("uploadBlocks", () => {
	it("stages each block, commits the list in order, and finalizes", async () => {
		const upload = { id: 7, name: "reads.fq.gz" };
		uploadServerFnMocks.finalizeChunkedUploadFn.mockResolvedValue(upload);

		// 10 bytes at a 4-byte block size is three blocks: 4, 4, 2.
		const file = new File(["0123456789"], "reads.fq.gz");

		await expect(uploadBlocks(init(), file)).resolves.toBe(upload);

		expect(blockRequests()).toHaveLength(3);
		for (const request of blockRequests()) {
			expect(request.method).toBe("PUT");
			expect(request.body).toBeInstanceOf(Blob);
		}

		const commit = blockListRequest();
		expect(commit?.body).toContain(`<Latest>${btoa("000000")}</Latest>`);
		expect(commit?.body).toContain(`<Latest>${btoa("000001")}</Latest>`);
		expect(commit?.body).toContain(`<Latest>${btoa("000002")}</Latest>`);

		expect(uploadServerFnMocks.finalizeChunkedUploadFn).toHaveBeenCalledWith({
			data: { id: 7 },
		});
	});

	it("commits an empty block list for a zero-byte file", async () => {
		uploadServerFnMocks.finalizeChunkedUploadFn.mockResolvedValue({ id: 7 });

		await uploadBlocks(init(), new File([], "empty.fq.gz"));

		expect(blockRequests()).toHaveLength(0);
		expect(blockListRequest()?.body).toBe(
			'<?xml version="1.0" encoding="utf-8"?><BlockList></BlockList>',
		);
	});

	it("limits block requests across simultaneous uploads", async () => {
		settleBlocksAutomatically = false;
		uploadServerFnMocks.finalizeChunkedUploadFn.mockImplementation(
			async ({ data }) => ({ id: data.id }),
		);

		const first = uploadBlocks(
			init({ uploadId: 7, url: "https://fd/c/first?sig=x" }),
			new File(["01234567890123456789"], "first.fq.gz"),
		);
		const second = uploadBlocks(
			init({ uploadId: 8, url: "https://fd/c/second?sig=x" }),
			new File(["01234567890123456789"], "second.fq.gz"),
		);

		await vi.waitFor(() => expect(blockRequests()).toHaveLength(4));

		while (blockRequests().length < 10) {
			const requestCount = blockRequests().length;
			for (const request of blockRequests()) {
				request.respond();
			}
			await vi.waitFor(() =>
				expect(blockRequests().length).toBeGreaterThan(requestCount),
			);
		}

		for (const request of blockRequests()) {
			request.respond();
		}

		await expect(Promise.all([first, second])).resolves.toEqual([
			{ id: 7 },
			{ id: 8 },
		]);
		expect(maxActiveBlocks).toBe(4);
	});

	it("cancels the reservation and rejects when a block fails", async () => {
		statusFor = (url) => (url.includes("comp=block&") ? 500 : 201);
		uploadServerFnMocks.cancelChunkedUploadFn.mockResolvedValue(null);

		const file = new File(["0123456789"], "reads.fq.gz");

		await expect(uploadBlocks(init(), file)).rejects.toThrow(
			"Block upload failed (500).",
		);

		expect(uploadServerFnMocks.cancelChunkedUploadFn).toHaveBeenCalledWith({
			data: { id: 7 },
		});
		expect(uploadServerFnMocks.finalizeChunkedUploadFn).not.toHaveBeenCalled();
	});
});
