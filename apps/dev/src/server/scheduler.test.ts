import { expect, it } from "vitest";
import { FairScheduler } from "./scheduler.ts";

it("rotates fairly across environment and workflow queues", () => {
	const scheduler = new FairScheduler();
	const candidates = [
		{ environmentId: "a", pending: 2, workflow: "nuvs" as const },
		{ environmentId: "b", pending: 2, workflow: "pathoscope" as const },
	];
	expect(scheduler.select(candidates, 1)[0]?.environmentId).toBe("a");
	expect(scheduler.select(candidates, 1)[0]?.environmentId).toBe("b");
});
