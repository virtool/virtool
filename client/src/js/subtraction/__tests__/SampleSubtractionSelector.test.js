import React from "react";
import { SampleSubtractionSelector } from "../components/Selector";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("<SampleSubtractionSelector />", () => {
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
        const wrapper = shallow(<SampleSubtractionSelector {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onChange when a subtraction is clicked", () => {
        renderWithProviders(<SampleSubtractionSelector {...props} />);
        expect(props.onChange).not.toHaveBeenCalled();
        userEvent.click(screen.getByText(props.subtractions[0].name));
        expect(props.onChange).toHaveBeenCalled();
    });

    it("should return the subtraction that is clicked", () => {
        let clickedValue = null;
        props.onChange = value => (clickedValue = value);
        renderWithProviders(<SampleSubtractionSelector {...props} />);

        expect(clickedValue).toEqual(null);
        userEvent.click(screen.getByText(props.subtractions[0].name));
        expect(clickedValue).toEqual([props.subtractions[0].id]);
    });
});
