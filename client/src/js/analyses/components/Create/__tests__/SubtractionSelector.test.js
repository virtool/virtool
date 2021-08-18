import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SubtractionSelector } from "../SubtractionSelector";

describe("<SubtractionSelector />", () => {
    let props;

    beforeEach(() => {
        props = {
            subtractions: [
                { id: "foo", name: "Foo" },
                { id: "bar", name: "Bar" }
            ],
            value: ["foo"],
            onChange: jest.fn()
        };
    });

    it("should render", () => {
        const wrapper = shallow(<SubtractionSelector {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onChange when change event occur on Input", () => {
        renderWithProviders(<SubtractionSelector {...props} />);
        expect(props.onChange).not.toHaveBeenCalled();
        userEvent.click(screen.getByText(props.subtractions[0].name));
        expect(props.onChange).toHaveBeenCalled();
    });
});
