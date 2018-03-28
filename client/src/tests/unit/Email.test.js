import React from "react";
import Enzyme, { mount, shallow, render } from "enzyme";
import Adapter from "enzyme-adapter-react-15";
import EmailContainer, { Email } from "../js/account/components/Email";

Enzyme.configure({ adapter: new Adapter() });

// This function is used to mock required props for the component
function setup() {
    const props = {
        //props go here
    };

    const enzymeWrapper = mount();

    return {
        props,
        enzymeWrapper
    };
}

const generateComponent = (extraProps={}) => (
    <Email {...extraProps} />
);

it("sample test", () => {
    let wrapper = mount(generateComponent());
});



describe("Email component", () => {
    it("should render without throwing error", () => {
        const { enzymeWrapper } = setup();

        //TODO
    });

    it("should be selectable by class 'classname'", () => {
        // Shallow Rendering
        const wrapper = shallow(<Email />);

        expect(wrapper.is(".classname")).toBe(true);
    });

    it("should mount in full DOM", () => {
        // Full rendering
        const wrapper = mount(<Email />);

        expect(wrapper.find(".classname")).toBe(1);
    });

    it("should render to static HTML", () => {
        // Static rendering
        const wrapper = render(<Email />);

        expect(wrapper.text()).toBe("text");
    });


});


// BASE COMPONENT
// renders, renders children, no props, invalid props, valid props, edge case props
// functions, arguments; valid, invalid, missing

// given a set of props and state, assert on component output
// given an event, assert on behaviour of component

// CONTAINER COMPONENT
// renders, redux testing