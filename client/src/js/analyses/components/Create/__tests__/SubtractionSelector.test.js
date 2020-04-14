import React from "react";
import { Select } from "../../../../base";
import { SubtractionSelector } from "../SubtractionSelector";

describe("<SubtractionSelector />", () => {
    let props;

    beforeEach(() => {
        props = {
            subtractions: [
                { id: "foo", name: "Foo" },
                { id: "bar", name: "Bar" }
            ],
            value: "foo",
            onChange: jest.fn()
        };
    });

    it("should render", () => {
        const wrapper = shallow(<SubtractionSelector {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onChange when change event occur on Input", () => {
        const wrapper = shallow(<SubtractionSelector {...props} />);
        expect(props.onChange).not.toHaveBeenCalled();
        wrapper.find(Select).simulate("change");
        expect(props.onChange).toHaveBeenCalled();
    });
});
