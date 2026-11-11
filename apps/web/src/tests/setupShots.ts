// Setup for the browser-based `shots` Vitest project. It adds one change to the
// `web` setup.
import { beforeEach } from "vitest";
import "./setupBrowser";

// A shot asserts nothing about when updates land, so React need not warn about
// updates outside `act`. Testing Library enables the act environment in its own
// `beforeAll`, so this runs after it.
beforeEach(() => {
	Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: false });
});
