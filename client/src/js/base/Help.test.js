import React from "react";
import { OverlayTrigger } from "react-bootstrap";
import { Help } from "./Help";

describe("<Help />", () => {
    let props = {
        title: "test",
        pullRight: false,
        children: <div className="test_div" />
    };
    let wrapper = shallow(<Help {...props} />);

    it("renders correctly", () => {
        expect(wrapper).toMatchSnapshot();
    });

    it("renders an OverlayTrigger component", () => {
        expect(wrapper.find(OverlayTrigger).exists()).toBe(true);
        expect(wrapper.find(OverlayTrigger)).toMatchSnapshot();
    });

    it("renders a question mark icon", () => {
        wrapper = mount(<Help {...props} />);

        expect(wrapper.find("i").hasClass("fa-question-circle")).toBe(true);
        expect(wrapper.find("i")).toMatchSnapshot();
    });

    it("renders even when title and pullRight props are missing", () => {
        props = { children: <div className="test_div" /> };
        wrapper = shallow(<Help {...props} />);

        expect(wrapper).toMatchSnapshot();
    });
});
