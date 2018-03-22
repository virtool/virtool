import React from "react";
import Enzyme, { mount } from "enzyme";
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

describe("Email component", () => {
    it("should render self and child components", () => {
        const { enzymeWrapper } = setup();

        
    });
});