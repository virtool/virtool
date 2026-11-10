// Setup for the browser-based `shots` Vitest project. The app stylesheet brings
// the Tailwind theme and the Inter font, so a shot looks like the running app.
// The jsdom stand-ins for layout APIs stay out: a real browser has them, and a
// noop ResizeObserver would leave measured views empty.
import "@app/style.css";
import { faker } from "@faker-js/faker";
import { beforeEach } from "vitest";
import "./fakeEventSource";
import "./serverFnMocks";

faker.seed(1);

// A shot asserts nothing about when updates land, so React need not warn about
// updates outside `act`. Testing Library enables the act environment in its own
// `beforeAll`, so this runs after it.
beforeEach(() => {
	Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: false });
});
