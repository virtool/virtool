import { screen } from "@testing-library/react";
import { createFakeHmmSearchResults } from "@tests/fake/hmm";
import { createFakeIndexMinimal } from "@tests/fake/indexes";
import { createFakeLabel } from "@tests/fake/labels";
import { createFakeSampleMinimal } from "@tests/fake/samples";
import { createFakeSubtractionNested } from "@tests/fake/subtractions";
import { createFakeUserNested } from "@tests/fake/user";
import { mockFindHmms } from "@tests/server-fn/hmm";
import { mockListReadyIndexes } from "@tests/server-fn/indexes";
import { mockFindLabels } from "@tests/server-fn/labels";
import {
	mockFindSamples,
	mockListSampleGroups,
} from "@tests/server-fn/samples";
import { mockListSubtractionsShortlist } from "@tests/server-fn/subtractions";
import { mockListUsers } from "@tests/server-fn/users";
import { at, renderRoute } from "@tests/setup";
import { takeShot } from "@tests/shot";
import { it } from "vitest";

it("samples list", async () => {
	const samples = Array.from({ length: 5 }, () => createFakeSampleMinimal());

	mockFindSamples(samples);
	mockListSampleGroups();
	mockFindLabels([createFakeLabel(), createFakeLabel()]);
	mockListUsers([createFakeUserNested(), createFakeUserNested()]);
	mockFindHmms(createFakeHmmSearchResults());
	mockListReadyIndexes([createFakeIndexMinimal()]);
	mockListSubtractionsShortlist([createFakeSubtractionNested()]);

	await renderRoute("/samples");
	await screen.findByText(at(samples, 0).name);

	await takeShot();
});
