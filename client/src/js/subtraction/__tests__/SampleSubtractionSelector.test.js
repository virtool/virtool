import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SampleSubtractionSelector } from "../components/Selector";
import { BrowserRouter } from "react-router-dom";

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

    const WrappedSampleSubtractionSelector = props => {
        return (
            <BrowserRouter>
                <SampleSubtractionSelector {...props}> </SampleSubtractionSelector>
            </BrowserRouter>
        );
    };

    it("should render no subtractions found message iff appropriate", () => {
        const modProps = { ...props, subtractions: [] };
        const testMessage = /No subtractions Found/i;

        renderWithProviders(<WrappedSampleSubtractionSelector {...props} />);
        expect(screen.queryByText(testMessage)).toBeNull();

        renderWithProviders(<WrappedSampleSubtractionSelector {...modProps} />);
        expect(screen.queryByText(testMessage)).toBeInTheDocument();
    });
});
