import { screen } from "@testing-library/react";
import { renderWithProviders } from "@tests/setup";
import { describe, expect, it } from "vitest";
import ProgressCircle from "../ProgressCircle";

describe("<ProgressCircle />", () => {
	it("should name the graphic with the progress", () => {
		renderWithProviders(<ProgressCircle progress={42} state="running" />);
		expect(screen.getByTitle("Progress: 42%")).toBeInTheDocument();
	});
});
