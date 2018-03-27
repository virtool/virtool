import React from "react";
// import Enzyme, { mount, shallow, render } from "enzyme";
// import Adapter from "enzyme-adapter-react-15";
import { Identicon } from "../../js/base/Identicon";

// Enzyme.configure({ adapter: new Adapter() });

// hash = hexadecimal string of 15+ characters used to generate the image
// size = pixel size of the generated square image
    // invalid values: negative, 0, +/- infinity, non number values

describe("<Identicon />", () => {

    it("renders correctly", () => {
        const size = 64;
        const hash = "d3b07384d113edec49eaa6238ad5ff00";

        const wrapper = shallow(<Identicon size={size} hash={hash} />);

        expect(wrapper).toMatchSnapshot();
    });

    it("renders an <img> element", () => {
        const size = 64;
        const hash = "d3b07384d113edec49eaa6238ad5ff00";

        const wrapper = shallow(<Identicon size={size} hash={hash} />);

        expect(wrapper.type()).toBe("img");
    });

    it("handles invalid values", () => {
        const size = 0;
        const hash = "d3b07384d113edec49eaa6238ad5ff00";

        const wrapper = shallow(<Identicon size={size} hash={hash} />);

        expect(wrapper.type()).toBe("img");
    });

});
