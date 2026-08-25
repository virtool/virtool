import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UploadInProgress } from "../types";
import {
	cancelAll,
	cancelUpload,
	postUpload,
	retryUpload,
	upload,
	useUploaderStore,
	watchUploadTiming,
} from "../uploader";

function flush(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

// A minimal, controllable stand-in for XMLHttpRequest. jsdom's real one would
// try to hit the network (which the test setup blocks), so `postUpload`'s
// event-to-promise translation is exercised by driving these emit* helpers.
class MockXhr {
	status = 0;
	responseText = "";
	method = "";
	url = "";
	body: unknown;
	upload = new EventTarget();
	private events = new EventTarget();

	open(method: string, url: string): void {
		this.method = method;
		this.url = url;
	}

	send(body: unknown): void {
		this.body = body;
	}

	addEventListener(type: string, listener: EventListener): void {
		this.events.addEventListener(type, listener);
	}

	emitLoad(status: number, responseText: string): void {
		this.status = status;
		this.responseText = responseText;
		this.events.dispatchEvent(new Event("load"));
	}

	emitError(): void {
		this.events.dispatchEvent(new Event("error"));
	}

	emitAbort(): void {
		this.events.dispatchEvent(new Event("abort"));
	}

	abort(): void {
		this.emitAbort();
	}

	emitProgress(loaded: number, total: number): void {
		this.upload.dispatchEvent(
			new ProgressEvent("progress", { lengthComputable: true, loaded, total }),
		);
	}
}

let xhr: MockXhr;

beforeEach(() => {
	vi.stubGlobal("XMLHttpRequest", function XMLHttpRequestStub() {
		xhr = new MockXhr();
		return xhr;
	});
});

afterEach(() => {
	useUploaderStore.setState({
		remaining: 0,
		samples: [],
		speed: 0,
		uploads: [],
	});
	vi.unstubAllGlobals();
});

function file(): File {
	return new File(["content"], "reads.fq.gz");
}

describe("postUpload", () => {
	it("posts to /uploads with the name and type in the query string", () => {
		postUpload(file(), "reads file.fq.gz", "reads");

		expect(xhr.method).toBe("POST");
		expect(xhr.url).toBe("/uploads?name=reads%20file.fq.gz&type=reads");
		expect(xhr.body).toBeInstanceOf(File);
	});

	it("resolves with the parsed upload on a 2xx response", async () => {
		const promise = postUpload(file(), "reads.fq.gz", "reads");
		xhr.emitLoad(201, JSON.stringify({ id: 42, name: "reads.fq.gz" }));

		await expect(promise).resolves.toMatchObject({
			id: 42,
			name: "reads.fq.gz",
		});
	});

	it("rejects with the server's message on a non-2xx JSON response", async () => {
		const promise = postUpload(file(), "reads.fq.gz", "reads");
		xhr.emitLoad(
			422,
			JSON.stringify({ message: "A valid `name` is required." }),
		);

		await expect(promise).rejects.toThrow("A valid `name` is required.");
	});

	it("falls back to the status code when the error body is not JSON", async () => {
		const promise = postUpload(file(), "reads.fq.gz", "reads");
		xhr.emitLoad(403, "Forbidden");

		await expect(promise).rejects.toThrow("Upload failed with status 403.");
	});

	it("rejects when the request errors", async () => {
		const promise = postUpload(file(), "reads.fq.gz", "reads");
		xhr.emitError();

		await expect(promise).rejects.toThrow("Upload failed.");
	});

	it("rejects when the request is aborted", async () => {
		const promise = postUpload(file(), "reads.fq.gz", "reads");
		xhr.emitAbort();

		await expect(promise).rejects.toThrow("Upload aborted.");
	});

	it("reports progress as loaded, total, and a rounded percent", async () => {
		const onProgress = vi.fn();

		const promise = postUpload(file(), "reads.fq.gz", "reads", onProgress);
		xhr.emitProgress(3, 10);
		xhr.emitProgress(7, 10);
		xhr.emitLoad(201, JSON.stringify({ id: 1 }));
		await promise;

		expect(onProgress).toHaveBeenNthCalledWith(1, {
			loaded: 3,
			total: 10,
			percent: 30,
		});
		expect(onProgress).toHaveBeenNthCalledWith(2, {
			loaded: 7,
			total: 10,
			percent: 70,
		});
	});

	it("aborts the request when its signal fires", () => {
		const controller = new AbortController();
		const promise = postUpload(
			file(),
			"reads.fq.gz",
			"reads",
			undefined,
			controller.signal,
		);
		controller.abort();

		return expect(promise).rejects.toThrow("Upload aborted.");
	});
});

describe("upload lifecycle", () => {
	function currentId(): string {
		const id = useUploaderStore.getState().uploads[0]?.localId;
		if (id === undefined) {
			throw new Error("expected an upload");
		}
		return id;
	}

	it("records the server's message when an upload fails", async () => {
		upload(file(), "reads");
		xhr.emitLoad(
			422,
			JSON.stringify({ message: "A valid `name` is required." }),
		);
		await flush();

		expect(useUploaderStore.getState().uploads[0]).toMatchObject({
			error: "A valid `name` is required.",
			failed: true,
		});
	});

	it("marks an upload completed on success, keeping it until dismissed", async () => {
		upload(file(), "reads");
		xhr.emitLoad(201, JSON.stringify({ id: 1 }));
		await flush();

		expect(useUploaderStore.getState().uploads[0]).toMatchObject({
			completed: true,
			progress: 100,
		});
	});

	it("cancels every upload at once", async () => {
		upload(file(), "reads");
		upload(file(), "reads");
		cancelAll();
		await flush();

		expect(useUploaderStore.getState().uploads).toHaveLength(0);
	});

	it("cancels an in-progress upload, dropping it without failing", async () => {
		upload(file(), "reads");
		cancelUpload(currentId());
		await flush();

		expect(useUploaderStore.getState().uploads).toHaveLength(0);
	});

	it("retries a failed upload in place with the same file", async () => {
		upload(file(), "reads");
		const localId = currentId();
		xhr.emitLoad(500, "Server Error");
		await flush();

		expect(useUploaderStore.getState().uploads[0]).toMatchObject({
			failed: true,
		});

		retryUpload(localId);
		expect(useUploaderStore.getState().uploads[0]).toMatchObject({
			error: undefined,
			failed: false,
			progress: 0,
		});

		expect(xhr.body).toBeInstanceOf(File);

		xhr.emitLoad(201, JSON.stringify({ id: 1 }));
		await flush();
		expect(useUploaderStore.getState().uploads[0]).toMatchObject({
			completed: true,
		});
	});
});

describe("watchUploadTiming", () => {
	it("derives speed from elapsed time between samples", () => {
		const inProgress: UploadInProgress = {
			completed: false,
			failed: false,
			fileType: "reads",
			loaded: 1000,
			localId: "a",
			name: "reads.fq.gz",
			progress: 50,
			size: 2000,
		};
		useUploaderStore.setState({ samples: [0, 500], uploads: [inProgress] });

		watchUploadTiming();

		const { remaining, speed } = useUploaderStore.getState();
		expect(speed).toBe(1000);
		expect(remaining).toBe(1);
	});
});
