import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import React from "react";
import { LabelForm } from "../Form";

describe("<LabelForm />", () => {
    let props;

    beforeEach(() => {
        props = {
            color: "#9F7AEA",
            description: "This is a test label",
            errorColor: "",
            errorName: "",
            name: "Foo",
            onChange: jest.fn(),
            onColorChange: jest.fn(),
            onSubmit: jest.fn()
        };
    });

    it("should render with prefilled fields", () => {
        renderWithProviders(<LabelForm {...props} />);
        expect(screen.getByLabelText("Name")).toHaveValue(props.name);
    });

    it("should call onChange() when fields change", () => {
        renderWithProviders(<LabelForm {...props} />);

        const nameInput = screen.getByLabelText("Name");
        userEvent.type(nameInput, "B");
        expect(props.onChange).toHaveBeenCalledWith("name", "FooB");

        const descriptionInput = screen.getByLabelText("Description");
        userEvent.type(descriptionInput, "A");
        expect(props.onChange).toHaveBeenCalledWith("description", "This is a test labelA");
    });

    it("should call onSubmit() when save button clicked", () => {
        renderWithProviders(<LabelForm {...props} />);
        expect(props.onSubmit).not.toHaveBeenCalled();
        const saveButton = screen.getByRole("button", { name: "Save" });
        userEvent.click(saveButton);
        expect(props.onSubmit).toHaveBeenCalled();
    });
});
