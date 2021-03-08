import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PUSH_STATE } from "../../../app/actionTypes";
import { EditLabel, mapDispatchToProps } from "../Edit";

describe("<EditLabel>", () => {
    let props;

    beforeEach(() => {
        props = {
            id: 1,
            name: "Foo",
            description: "This is a description",
            color: "#1DAD57",
            show: true,
            onHide: jest.fn(),
            onSubmit: jest.fn()
        };
    });

    it("should change visibility based on show prop", () => {
        const { rerender } = renderWithProviders(<EditLabel {...props} />);
        expect(screen.queryByLabelText("Name")).toBeInTheDocument();

        rerender(<EditLabel {...props} show={false} />);
        expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
    });

    it("should initially populate inputs with props", () => {
        renderWithProviders(<EditLabel {...props} />);

        expect(screen.getByLabelText("Color")).toHaveValue("#1DAD57");
        expect(screen.getByLabelText("Description")).toHaveValue("This is a description");
        expect(screen.getByLabelText("Name")).toHaveValue("Foo");
    });

    it("should call onSubmit when successfully submitted", () => {
        renderWithProviders(<EditLabel {...props} />);
        userEvent.click(screen.getByRole("button", { name: "Save" }));
        expect(props.onSubmit).toHaveBeenCalledWith(1, "Foo", "This is a description", "#1DAD57");
    });

    it("should update color when input changes", () => {
        renderWithProviders(<EditLabel {...props} />);

        const colorInput = screen.getByLabelText("Color");
        colorInput.value = "";
        expect(colorInput).toHaveValue("");

        userEvent.type(colorInput, "#000000");
        expect(colorInput).toHaveValue("#000000");

        userEvent.click(screen.getByRole("button", { name: "Save" }));
        expect(props.onSubmit).toHaveBeenCalledWith(1, "Foo", "This is a description", "#000000");
    });

    it("should update description when input changes", () => {
        renderWithProviders(<EditLabel {...props} />);

        const descriptionInput = screen.getByLabelText("Description");
        expect(descriptionInput).toHaveValue("This is a description");
        descriptionInput.value = "";
        expect(descriptionInput).toHaveValue("");

        userEvent.type(descriptionInput, "This is a label");
        expect(descriptionInput).toHaveValue("This is a label");

        userEvent.click(screen.getByRole("button", { name: "Save" }));
        expect(props.onSubmit).toHaveBeenCalledWith(1, "Foo", "This is a label", "#1DAD57");
    });

    it("should update name when input changes", () => {
        renderWithProviders(<EditLabel {...props} />);

        const nameInput = screen.getByLabelText("Name");

        nameInput.value = "";
        expect(nameInput).toHaveValue("");

        userEvent.type(nameInput, "Bar");
        expect(nameInput).toHaveValue("Bar");

        userEvent.click(screen.getByRole("button", { name: "Save" }));
        expect(props.onSubmit).toHaveBeenCalledWith(1, "Bar", "This is a description", "#1DAD57");
    });
});

describe("mapDispatchToProps()", () => {
    let dispatch;
    let props;

    beforeEach(() => {
        dispatch = jest.fn();
        props = mapDispatchToProps(dispatch);
    });

    it("should return onSubmit in props", () => {
        const labelId = "1";
        const name = "FooBar";
        const description = "BarFoo";
        const color = "#000000";
        props.onSubmit(labelId, name, description, color);
        expect(dispatch).toHaveBeenCalledWith({
            type: "UPDATE_LABEL_REQUESTED",
            labelId,
            name,
            description,
            color
        });
    });

    it("should return onHide in props", () => {
        props.onHide();
        expect(dispatch).toHaveBeenCalledWith({
            type: PUSH_STATE,
            state: {
                editLabel: false
            }
        });
    });
});
