import React from "react";
import { MultiSubtractionSelector } from "../MultiSubtractionSelector";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("<MultiSubtractionSelector />", () => {
    let props;

    beforeEach(() => {
        props = {
            name: "Name",
            noun: "Noun",
            subtractions: [
                { id: "foo", name: "Foo" },
                { id: "bar", name: "Bar" }
            ],
            selected: [],
            onChange: jest.fn()
        };
    });

    it("should render", () => {
        const wrapper = shallow(<MultiSubtractionSelector {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onChange when a subtraction is clicked", () => {
        renderWithProviders(<MultiSubtractionSelector {...props} />);
        expect(props.onChange).not.toHaveBeenCalled();
        userEvent.click(screen.getByText(props.subtractions[0].name));
        expect(props.onChange).toHaveBeenCalled();
    });

    it("should return a subtraction is clicked", () => {
        let clickedValue = null;
        props.onChange = value => (clickedValue = value);
        renderWithProviders(<MultiSubtractionSelector {...props} />);

        expect(clickedValue).toEqual(null);
        userEvent.click(screen.getByText(props.subtractions[0].name));
        expect(clickedValue).toEqual([props.subtractions[0].id]);
    });
});
