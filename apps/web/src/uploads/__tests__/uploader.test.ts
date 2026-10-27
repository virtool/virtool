import { afterEach, describe, expect, it } from "vitest";
import type { UploadInProgress } from "../types";
import {
	cancelAll,
	cancelUpload,
	upload,
	useUploaderStore,
	watchUploadTiming,
} from "../uploader";

afterEach(() => {
	useUploaderStore.setState({
		remaining: 0,
		samples: [],
		sampleIds: [],
		speed: 0,
		uploads: [],
	});
});

function file(): File {
	return new File(["content"], "reads.fq.gz");
}

describe("upload lifecycle", () => {
	it("cancels every upload at once", () => {
		upload(file(), "reads");
		upload(file(), "reads");
		cancelAll();
		expect(useUploaderStore.getState().uploads).toHaveLength(0);
	});

	it("cancels an in-progress upload", () => {
		upload(file(), "reads");
		const localId = useUploaderStore.getState().uploads[0]?.localId;
		expect(localId).toBeDefined();
		cancelUpload(localId ?? "");
		expect(useUploaderStore.getState().uploads).toHaveLength(0);
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
		useUploaderStore.setState({
			samples: [0, 500],
			sampleIds: ["a"],
			uploads: [inProgress],
		});

		watchUploadTiming();

		expect(useUploaderStore.getState()).toMatchObject({
			remaining: 1,
			speed: 1000,
		});
	});

	it("rebases samples when an upload leaves the active set", () => {
		const active: UploadInProgress = {
			completed: false,
			failed: false,
			fileType: "reads",
			loaded: 1000,
			localId: "a",
			name: "a.fq.gz",
			progress: 50,
			size: 2000,
		};
		const finished: UploadInProgress = {
			...active,
			completed: true,
			loaded: 2000,
			localId: "b",
			name: "b.fq.gz",
			progress: 100,
		};
		useUploaderStore.setState({
			samples: [0, 3000],
			sampleIds: ["a", "b"],
			uploads: [active, finished],
		});

		watchUploadTiming();

		expect(useUploaderStore.getState()).toMatchObject({
			sampleIds: ["a"],
			samples: [1000],
			speed: 0,
		});
	});
});
