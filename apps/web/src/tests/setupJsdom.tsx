// Setup for the jsdom `web` project.
import { faker } from "@faker-js/faker";
import "@testing-library/jest-dom/vitest";
import { fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import "./fakeEventSource";
import "./serverFnMocks";
import { renderWithProviders, wrapWithProviders } from "./setup";

process.env.TZ = "UTC";

faker.seed(1);

//mocks HTML element prototypes that are not implemented in jsdom
window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.releasePointerCapture = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn();
window.scrollTo = vi.fn();
document.elementFromPoint = vi.fn(() => null);

class ResizeObserver {
	observe() {}
	unobserve() {}
	disconnect() {}
}

function attachResizeObserver() {
	window.ResizeObserver = ResizeObserver;
}

attachResizeObserver();

// Globals are defined here to limit import redundancies.
const testGlobals = globalThis as typeof globalThis & {
	fireEvent: typeof fireEvent;
	userEvent: typeof userEvent;
	renderWithProviders: typeof renderWithProviders;
	wrapWithProviders: typeof wrapWithProviders;
};
testGlobals.fireEvent = fireEvent;
testGlobals.userEvent = userEvent;
testGlobals.renderWithProviders = renderWithProviders;
testGlobals.wrapWithProviders = wrapWithProviders;
