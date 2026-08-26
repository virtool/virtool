import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { uploadServerFnMocks } from "../../tests/server-fn/uploads";
import { type ChunkedInit, uploadBlocks } from "../chunkedUpload";

// The status a request settles with, chosen from its URL so a test can fail
// just the block PUTs while the commit and everything else succeed.
let statusFor: (url: string) => number;

// Every request the run made, in creation order.
let requests: MockXhr[];

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
		queueMicrotask(() => {
			if (this.aborted) {
				return;
			}
			this.status = statusFor(this.url);
			this.events.dispatchEvent(new Event("load"));
		});
	}

	addEventListener(type: string, listener: EventListener): void {
		this.events.addEventListener(type, listener);
	}

	abort(): void {
		this.aborted = true;
		this.events.dispatchEvent(new Event("abort"));
	}
}

function init(overrides: Partial<ChunkedInit> = {}): ChunkedInit {
	return {
		uploadId: 7,
		url: "https://fd/c/blob?sig=x",
		blockSize: 4,
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
