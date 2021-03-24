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

    it("should call onSubmit when successfully submitted", () => {
        renderWithProviders(<EditLabel {...props} />);
        userEvent.click(screen.getByRole("button", { name: "Save" }));
        expect(props.onSubmit).toHaveBeenCalledWith(1, "Foo", "This is a description", "#1DAD57");
    });

    it("should initialize and update name and description", () => {
        renderWithProviders(<EditLabel {...props} />);

        const descriptionInput = screen.getByLabelText("Description");
        const nameInput = screen.getByLabelText("Name");

        // Field initialize from props.
        expect(nameInput).toHaveValue("Foo");
        expect(descriptionInput).toHaveValue("This is a description");

        // Check fields clear.
        userEvent.clear(descriptionInput);
        userEvent.clear(nameInput);
        expect(descriptionInput).toHaveValue("");
        expect(nameInput).toHaveValue("");

        // Check typing changes input value
        userEvent.type(descriptionInput, "This is a label");
        userEvent.type(nameInput, "Bar");
        expect(descriptionInput).toHaveValue("This is a label");
        expect(nameInput).toHaveValue("Bar");
    });

    it("should initialize and update color", () => {
        renderWithProviders(<EditLabel {...props} />);

        const colorInput = screen.getByLabelText("Color");

        // Initializes from props.
        expect(colorInput).toHaveValue(props.color);

        // Updates when input cleared.
        userEvent.clear(colorInput);
        expect(colorInput).toHaveValue("");

        // Updates when input is typed in.
        userEvent.type(colorInput, "#DFDF12");
        expect(colorInput).toHaveValue("#DFDF12");

        // Updates when color square is clicked.
        userEvent.click(screen.getByTitle("#3B82F6"));
        expect(colorInput).toHaveValue("#3B82F6");
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
