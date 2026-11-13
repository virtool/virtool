import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ProgressCircle from "../ProgressCircle";

describe("<ProgressCircle />", () => {
	// The server render and the hydration render have to agree. React's server
	// renderer only writes a `<title>` whose children are a single string, so
	// `<title>Progress: {progress}%</title>` served an empty one and every list
	// carrying a progress circle failed hydration and re-rendered from scratch.
	it("should render the same title on the server as in the browser", () => {
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => {});

		const html = renderToString(
			createElement(ProgressCircle, { progress: 42, state: "running" }),
		);

		expect(consoleError).not.toHaveBeenCalled();
		consoleError.mockRestore();

		expect(html).toContain("<title>Progress: 42%</title>");
	});
});
