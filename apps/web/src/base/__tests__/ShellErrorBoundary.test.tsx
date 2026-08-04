import * as Sentry from "@sentry/tanstackstart-react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import ShellErrorBoundary from "../ShellErrorBoundary";

vi.mock("@sentry/tanstackstart-react", () => ({
	captureException: vi.fn(),
}));

type Control = { throwing: boolean; value: unknown };

/**
 * Throws `control.value` for as long as `control.throwing` is set, standing in
 * for `MatchInner` throwing a cleared `loadPromise` while a redirect settles.
 *
 * The flag is read fresh on every render rather than counted down: React
 * re-renders the root synchronously after a concurrent render throws, so a
 * counter would be spent by the retry before the boundary ever caught anything.
 */
function Thrower({
	control,
	children,
}: {
	control: Control;
	children: ReactNode;
}) {
	if (control.throwing) {
		throw control.value;
	}

	return children;
}

let unmount: (() => void) | undefined;

/**
 * Renders into a root whose error hooks are silenced.
 *
 * `@testing-library/react` gives no way to pass them, and without them React
 * hands every error the boundary catches to `reportError`, which jsdom raises
 * as an uncaught exception and Vitest fails the run on.
 */
function renderBoundary(ui: ReactNode) {
	const container = document.createElement("div");
	document.body.appendChild(container);

	const root = createRoot(container, {
		onCaughtError: () => undefined,
		onRecoverableError: () => undefined,
		onUncaughtError: () => undefined,
	});

	act(() => {
		root.render(ui);
	});

	unmount = () => {
		act(() => {
			root.unmount();
		});
		container.remove();
	};
}

/** Lets the boundary's `setTimeout` fire and React commit what follows. */
async function settle() {
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 0));
	});
}

const FAILED_MESSAGE = "Virtool ran into a problem and couldn't continue";

afterEach(() => {
	unmount?.();
	unmount = undefined;
	vi.restoreAllMocks();
	vi.mocked(Sentry.captureException).mockReset();
});

describe("ShellErrorBoundary", () => {
	it("should render its children when nothing throws", () => {
		renderBoundary(
			<ShellErrorBoundary>
				<p>Samples</p>
			</ShellErrorBoundary>,
		);

		expect(screen.getByText("Samples")).toBeInTheDocument();
	});

	it("should remount the tree after a falsy throw instead of going blank", async () => {
		const control: Control = { throwing: true, value: undefined };

		renderBoundary(
			<ShellErrorBoundary>
				<Thrower control={control}>
					<p>Samples</p>
				</Thrower>
			</ShellErrorBoundary>,
		);

		expect(screen.queryByText("Samples")).not.toBeInTheDocument();

		control.throwing = false;
		await settle();

		expect(screen.getByText("Samples")).toBeInTheDocument();
		expect(screen.queryByText(FAILED_MESSAGE)).not.toBeInTheDocument();
	});

	it("should report a falsy throw to sentry as a named error", async () => {
		const control: Control = { throwing: true, value: undefined };

		renderBoundary(
			<ShellErrorBoundary>
				<Thrower control={control}>
					<p>Samples</p>
				</Thrower>
			</ShellErrorBoundary>,
		);

		control.throwing = false;
		await settle();

		expect(Sentry.captureException).toHaveBeenCalledWith(
			expect.objectContaining({
				message: "Router threw a falsy value and unmounted the app",
			}),
			expect.objectContaining({ tags: { router: "falsy-throw" } }),
		);
	});

	it("should offer a reload once the falsy throws stop being a race", async () => {
		const control: Control = { throwing: true, value: undefined };

		renderBoundary(
			<ShellErrorBoundary>
				<Thrower control={control}>
					<p>Samples</p>
				</Thrower>
			</ShellErrorBoundary>,
		);

		// One settle per retry the boundary is allowed, plus one for the give-up.
		await settle();
		await settle();
		await settle();

		expect(screen.getByText(FAILED_MESSAGE)).toBeInTheDocument();

		const reload = vi.fn();
		const original = window.location;
		Object.defineProperty(window, "location", {
			configurable: true,
			value: { ...original, reload },
		});

		try {
			await userEvent.click(screen.getByRole("button", { name: "Reload" }));
			expect(reload).toHaveBeenCalledOnce();
		} finally {
			Object.defineProperty(window, "location", {
				configurable: true,
				value: original,
			});
		}
	});

	it("should not retry a real error, and should report it as thrown", async () => {
		const error = new Error("boom");
		const control: Control = { throwing: true, value: error };

		renderBoundary(
			<ShellErrorBoundary>
				<Thrower control={control}>
					<p>Samples</p>
				</Thrower>
			</ShellErrorBoundary>,
		);

		control.throwing = false;
		await settle();

		expect(screen.getByText(FAILED_MESSAGE)).toBeInTheDocument();
		expect(screen.queryByText("Samples")).not.toBeInTheDocument();
		expect(Sentry.captureException).toHaveBeenCalledWith(
			error,
			expect.not.objectContaining({ tags: expect.anything() }),
		);
	});
});
