import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PUSH_STATE } from "../../../app/actionTypes";
import { CreateLabel, mapDispatchToProps } from "../Create";

describe("<CreateLabel>", () => {
    let props;

    beforeEach(() => {
        props = {
            show: true,
            onHide: jest.fn(),
            onSubmit: jest.fn()
        };
    });

    it("should call onSubmit when successfully submitted", () => {
        renderWithProviders(<CreateLabel {...props} />);

        const nameInput = screen.getByLabelText("Name");
        const descriptionInput = screen.getByLabelText("Description");

        userEvent.type(descriptionInput, "This is a description");
        userEvent.type(nameInput, "Foo");

        expect(descriptionInput).toHaveValue("This is a description");
        expect(nameInput).toHaveValue("Foo");

        userEvent.click(screen.getByRole("button", { name: "Save" }));

        expect(props.onSubmit).toHaveBeenCalledWith("Foo", "This is a description", "#3C8786");
    });

    it("should render error when submitted without color", () => {
        renderWithProviders(<CreateLabel {...props} />);

        expect(screen.queryByText("Please select a color")).not.toBeInTheDocument();

        userEvent.type(screen.getByLabelText("Name"), "Foo");
        userEvent.type(screen.getByLabelText("Description"), "This is a description");
        userEvent.clear(screen.getByLabelText("Color"));

        userEvent.click(screen.getByRole("button", { name: "Save" }));

        expect(screen.queryByText("Please select a color")).toBeInTheDocument();
    });

    it("should render error when submitted without name", () => {
        renderWithProviders(<CreateLabel {...props} />);

        expect(screen.queryByText("Please enter a name")).not.toBeInTheDocument();

        userEvent.type(screen.getByLabelText("Color"), "#1DAD57");
        userEvent.type(screen.getByLabelText("Description"), "This is a description");

        userEvent.click(screen.getByRole("button", { name: "Save" }));

        expect(screen.queryByText("Please enter a name")).toBeInTheDocument();
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
        const name = "FooBar";
        const description = "BarFoo";
        const color = "#000000";
        props.onSubmit(name, description, color);
        expect(dispatch).toHaveBeenCalledWith({
            type: "CREATE_LABEL_REQUESTED",
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
                createLabel: false
            }
        });
    });
});
