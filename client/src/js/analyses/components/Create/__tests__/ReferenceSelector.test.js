import { screen } from "@testing-library/react";
import { ReferenceSelector } from "../ReferenceSelector.js";

describe("<ReferenceSelector />", () => {
    let props;

    beforeEach(() => {
        props = {
            hasError: false,
            indexes: [
                { id: "foo", version: 1, reference: { id: "refFoo", name: "Ref Foo" } },
                { id: "bar", version: 3, reference: { id: "refBar", name: "Ref Bar" } }
            ],
            selected: [],
            onChange: jest.fn()
        };
    });

    it("should render without error", () => {
        renderWithProviders(<ReferenceSelector {...props} />);

        expect(screen.getByText("Ref Foo")).toBeInTheDocument();
        expect(screen.getByText("Ref Bar")).toBeInTheDocument();

        expect(screen.queryByText("Reference(s) must be selected")).not.toBeInTheDocument();
    });

    it("should render with error", () => {
        props.hasError = true;
        renderWithProviders(<ReferenceSelector {...props} />);
        expect(screen.queryByText("Reference(s) must be selected")).toBeInTheDocument();
    });

    it("should call onChange with selection when item clicked", async () => {
        renderWithProviders(<ReferenceSelector {...props} />);
        await screen.getByText("Ref Bar").click();
        expect(props.onChange).toHaveBeenCalledWith(["refBar"]);
    });

    it("should call onChange with selection when selected item clicked", async () => {
        props.selected = ["refFoo", "refBar"];
        renderWithProviders(<ReferenceSelector {...props} />);

        await screen.getByText("Ref Bar").click();
        expect(props.onChange).toHaveBeenCalledWith(["refFoo"]);
    });
});
