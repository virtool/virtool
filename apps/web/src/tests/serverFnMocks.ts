// Registers the global server-function mocks and resets them before each test.
// The `web` and `shots` setups both import this, so both projects render
// against the same stubs.
import { beforeEach, vi } from "vitest";
import { blogIndexMocks } from "./blogIndex";
import { accountServerFnMocks } from "./server-fn/account";
import { analysisServerFnMocks } from "./server-fn/analyses";
import { authServerFnMocks } from "./server-fn/auth";
import { bannerServerFnMocks } from "./server-fn/banners";
import { changelogServerFnMocks } from "./server-fn/changelog";
import { emailServerFnMocks } from "./server-fn/email";
import { groupServerFnMocks } from "./server-fn/groups";
import { hmmServerFnMocks } from "./server-fn/hmm";
import { indexServerFnMocks } from "./server-fn/indexes";
import { jobServerFnMocks } from "./server-fn/jobs";
import { labelServerFnMocks } from "./server-fn/labels";
import { genbankServerFnMocks, otuServerFnMocks } from "./server-fn/otus";
import { recentAuthenticationServerFnMocks } from "./server-fn/recentAuthentication";
import { recoveryServerFnMocks } from "./server-fn/recovery";
import { referenceServerFnMocks } from "./server-fn/references";
import { rootServerFnMocks } from "./server-fn/root";
import { sampleServerFnMocks } from "./server-fn/samples";
import {
	mockGetPasswordPolicy,
	settingsServerFnMocks,
} from "./server-fn/settings";
import { subtractionServerFnMocks } from "./server-fn/subtractions";
import { taskServerFnMocks } from "./server-fn/tasks";
import { uploadServerFnMocks } from "./server-fn/uploads";
import { userServerFnMocks } from "./server-fn/users";

vi.mock("@server/groups/functions", () => groupServerFnMocks);
vi.mock("@server/banners/functions", () => bannerServerFnMocks);
vi.mock("@server/analyses/functions", async () => {
	const { analysisServerFnMocks } = await import("./server-fn/analyses");
	return analysisServerFnMocks;
});
vi.mock("@server/account/functions", async () => {
	const { accountServerFnMocks } = await import("./server-fn/account");
	return accountServerFnMocks;
});
vi.mock("@nav/blogIndex", async () => {
	const { blogIndexMocks } = await import("./blogIndex");
	return blogIndexMocks;
});
vi.mock("@server/changelog/functions", async () => {
	const { changelogServerFnMocks } = await import("./server-fn/changelog");
	return changelogServerFnMocks;
});
// See the users mock below for why this resolves the mock via dynamic import.
vi.mock("@server/auth/functions", async () => {
	const { authServerFnMocks } = await import("./server-fn/auth");
	return authServerFnMocks;
});
vi.mock("@server/auth/recoveryFunctions", async () => {
	const { recoveryServerFnMocks } = await import("./server-fn/recovery");
	return recoveryServerFnMocks;
});
vi.mock("@server/auth/recentAuthentication", async () => {
	const { recentAuthenticationServerFnMocks } = await import(
		"./server-fn/recentAuthentication"
	);
	return recentAuthenticationServerFnMocks;
});
// Resolve the mock lazily via dynamic import. A direct reference to the
// imported `userServerFnMocks` binding races route modules (pulled in by
// `routeTree`) that import the mocked module before this binding initializes.
vi.mock("@server/users/functions", async () => {
	const { userServerFnMocks } = await import("./server-fn/users");
	return userServerFnMocks;
});
vi.mock("@server/root/functions", async () => {
	const { rootServerFnMocks } = await import("./server-fn/root");
	return rootServerFnMocks;
});
vi.mock("@server/hmm/functions", async () => {
	const { hmmServerFnMocks } = await import("./server-fn/hmm");
	return hmmServerFnMocks;
});
vi.mock("@server/jobs/functions", async () => {
	const { jobServerFnMocks } = await import("./server-fn/jobs");
	return jobServerFnMocks;
});
vi.mock("@server/tasks/functions", async () => {
	const { taskServerFnMocks } = await import("./server-fn/tasks");
	return taskServerFnMocks;
});
vi.mock("@server/email/functions", async () => {
	const { emailServerFnMocks } = await import("./server-fn/email");
	return emailServerFnMocks;
});
vi.mock("@server/settings/functions", async () => {
	const { settingsServerFnMocks } = await import("./server-fn/settings");
	return settingsServerFnMocks;
});
vi.mock("@server/labels/functions", async () => {
	const { labelServerFnMocks } = await import("./server-fn/labels");
	return labelServerFnMocks;
});
vi.mock("@server/uploads/functions", async () => {
	const { uploadServerFnMocks } = await import("./server-fn/uploads");
	return uploadServerFnMocks;
});
vi.mock("@server/subtraction/functions", async () => {
	const { subtractionServerFnMocks } = await import("./server-fn/subtractions");
	return subtractionServerFnMocks;
});

vi.mock("@server/references/functions", async () => {
	const { referenceServerFnMocks } = await import("./server-fn/references");
	return referenceServerFnMocks;
});

vi.mock("@server/samples/functions", async () => {
	const { sampleServerFnMocks } = await import("./server-fn/samples");
	return sampleServerFnMocks;
});

vi.mock("@server/otus/functions", async () => {
	const { otuServerFnMocks } = await import("./server-fn/otus");
	return otuServerFnMocks;
});

vi.mock("@server/genbank/functions", async () => {
	const { genbankServerFnMocks } = await import("./server-fn/otus");
	return genbankServerFnMocks;
});

vi.mock("@server/indexes/functions", async () => {
	const { indexServerFnMocks } = await import("./server-fn/indexes");
	return indexServerFnMocks;
});

beforeEach(() => {
	for (const fn of [
		groupServerFnMocks.createGroupFn,
		groupServerFnMocks.updateGroupFn,
		groupServerFnMocks.deleteGroupFn,
	]) {
		fn.mockReset();
	}
	for (const fn of [
		groupServerFnMocks.listGroupsFn,
		groupServerFnMocks.findGroupsFn,
		groupServerFnMocks.getGroupFn,
		...Object.values(userServerFnMocks),
		...Object.values(accountServerFnMocks),
		...Object.values(jobServerFnMocks),
		...Object.values(taskServerFnMocks),
		...Object.values(hmmServerFnMocks),
		...Object.values(authServerFnMocks),
		bannerServerFnMocks.findBannerFn,
		bannerServerFnMocks.findBannersFn,
		...Object.values(changelogServerFnMocks),
		...Object.values(blogIndexMocks),
		...Object.values(recoveryServerFnMocks),
		...Object.values(recentAuthenticationServerFnMocks),
		...Object.values(labelServerFnMocks),
		...Object.values(rootServerFnMocks),
		uploadServerFnMocks.findUploadsFn,
		uploadServerFnMocks.deleteUploadFn,
		subtractionServerFnMocks.findSubtractionsFn,
		subtractionServerFnMocks.getSubtractionFn,
		subtractionServerFnMocks.listSubtractionsShortlistFn,
		referenceServerFnMocks.findReferencesFn,
		referenceServerFnMocks.getReferenceFn,
		sampleServerFnMocks.findSamplesFn,
		sampleServerFnMocks.findRecentlyViewedSamplesFn,
		sampleServerFnMocks.getSampleFn,
		sampleServerFnMocks.listSampleGroupsFn,
		analysisServerFnMocks.findAnalysesFn,
		analysisServerFnMocks.findRecentlyViewedAnalysesFn,
		analysisServerFnMocks.getAnalysisFn,
		analysisServerFnMocks.getAnalysisResultsFn,
		analysisServerFnMocks.listAnalysisUsersFn,
		settingsServerFnMocks.getSettingsFn,
		settingsServerFnMocks.getCacheUsageFn,
		emailServerFnMocks.getEmailSettingsFn,
		...Object.values(indexServerFnMocks),
		otuServerFnMocks.findOtusFn,
		otuServerFnMocks.getOtuFn,
		otuServerFnMocks.listOtuHistoryFn,
	]) {
		fn.mockReset();
		// Default to a pending promise so an un-stubbed query renders its loading
		// state instead of resolving to `undefined`.
		fn.mockReturnValue(new Promise(() => {}));
	}

	for (const fn of [
		bannerServerFnMocks.clearActiveBannerFn,
		bannerServerFnMocks.createBannerFn,
		bannerServerFnMocks.deleteBannerFn,
		bannerServerFnMocks.setActiveBannerFn,
		bannerServerFnMocks.updateBannerFn,
		subtractionServerFnMocks.createSubtractionFn,
		subtractionServerFnMocks.updateSubtractionFn,
		subtractionServerFnMocks.deleteSubtractionFn,
		referenceServerFnMocks.createReferenceFn,
		referenceServerFnMocks.updateReferenceFn,
		referenceServerFnMocks.archiveReferenceFn,
		referenceServerFnMocks.unarchiveReferenceFn,
		referenceServerFnMocks.addReferenceUserFn,
		referenceServerFnMocks.addReferenceGroupFn,
		referenceServerFnMocks.updateReferenceUserFn,
		referenceServerFnMocks.updateReferenceGroupFn,
		referenceServerFnMocks.removeReferenceUserFn,
		referenceServerFnMocks.removeReferenceGroupFn,
		uploadServerFnMocks.finalizeChunkedUploadFn,
		uploadServerFnMocks.cancelChunkedUploadFn,
		sampleServerFnMocks.createSampleFn,
		sampleServerFnMocks.updateSampleFn,
		sampleServerFnMocks.deleteSampleFn,
		sampleServerFnMocks.updateSampleRightsFn,
		sampleServerFnMocks.recordSampleViewFn,
		analysisServerFnMocks.createAnalysisFn,
		analysisServerFnMocks.deleteAnalysisFn,
		analysisServerFnMocks.recordAnalysisViewFn,
		analysisServerFnMocks.blastNuvsFn,
		settingsServerFnMocks.updateSettingsFn,
		settingsServerFnMocks.clearNcbiApiKeyFn,
		settingsServerFnMocks.setNcbiApiKeyFn,
		emailServerFnMocks.clearEmailApiKeyFn,
		emailServerFnMocks.sendTestEmailFn,
		emailServerFnMocks.setEmailApiKeyFn,
		emailServerFnMocks.updateEmailSettingsFn,
		otuServerFnMocks.createOtuFn,
		otuServerFnMocks.updateOtuFn,
		otuServerFnMocks.deleteOtuFn,
		otuServerFnMocks.createIsolateFn,
		otuServerFnMocks.updateIsolateFn,
		otuServerFnMocks.setIsolateAsDefaultFn,
		otuServerFnMocks.deleteIsolateFn,
		otuServerFnMocks.createSequenceFn,
		otuServerFnMocks.updateSequenceFn,
		otuServerFnMocks.deleteSequenceFn,
		genbankServerFnMocks.getGenbankFn,
	]) {
		fn.mockReset();
	}

	// Unlike the mocks above, the password policy defaults to resolving. Every
	// password form queries it, and leaving it pending would silently exercise
	// the fallback minimum in tests that mean to assert the configured one.
	settingsServerFnMocks.getPasswordPolicyFn.mockReset();
	mockGetPasswordPolicy();

	// Resolving fresh lets route tests render the administration views rather
	// than the authentication gate in front of them.
	recentAuthenticationServerFnMocks.getRecentAuthenticationRemainingFn.mockResolvedValue(
		15 * 60 * 1000,
	);

	// The security view lists passkeys, so any test rendering it needs a list.
	accountServerFnMocks.findPasskeysFn.mockResolvedValue([]);

	// Every upload begins by asking the server which transport to take. Default
	// to the proxied path so a test that just exercises uploading does not have
	// to stub it; tests for the chunked path override this.
	uploadServerFnMocks.initUploadFn.mockReset();
	uploadServerFnMocks.initUploadFn.mockResolvedValue({
		uploadId: 1,
		url: "https://storage.test/blob?sig=test",
		blockSize: 16 * 1024 * 1024,
		concurrency: 1,
	});
});
