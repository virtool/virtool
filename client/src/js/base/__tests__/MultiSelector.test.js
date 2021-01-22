import { screen } from "@testing-library/react";
import React from "react";
import { MultiSelector, MultiSelectorItem } from "../MultiSelector";

describe("<MultiSelector />", () => {
    let selected;
    let handleChange;

    beforeEach(() => {
        selected = ["bar", "fiz"];
        handleChange = jest.fn();

        renderWithProviders(
            <MultiSelector noun="things" selected={selected} onChange={handleChange}>
                <MultiSelectorItem value="foo">Foo</MultiSelectorItem>
                <MultiSelectorItem value="bar">Bar</MultiSelectorItem>
                <MultiSelectorItem value="fiz">Fiz</MultiSelectorItem>
            </MultiSelector>
        );
    });

    it("should render children", async () => {
        const foo = screen.getByText("Foo");
        const bar = screen.getByText("Bar");
        const fiz = screen.getByText("Fiz");

        expect(foo).toBeInTheDocument();
        expect(fiz).toBeInTheDocument();
        expect(bar).toBeInTheDocument();

        expect(foo).toHaveStyleRule("background-color", "transparent");
        expect(fiz).toHaveStyleRule("background-color", "#0B7FE5");
        expect(fiz).toHaveStyleRule("background-color", "#0B7FE5");
    });

    it("should add to selected when unselected item clicked", async () => {
        await screen.getByText("Foo").click();
        expect(handleChange).toHaveBeenCalledWith(["bar", "fiz", "foo"]);
    });

    it("should drop from selected when selected item clicked", async () => {
        await screen.getByText("Fiz").click();
        expect(handleChange).toHaveBeenCalledWith(["bar"]);
    });
});
