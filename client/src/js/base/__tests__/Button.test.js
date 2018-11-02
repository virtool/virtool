import { OverlayTrigger } from "react-bootstrap";
import { Button } from "../Button";
import { Icon } from "../Icon";

describe("<Button />", () => {
    let props;
    let wrapper;

    it("renders correctly", () => {
        wrapper = shallow(<Button />);

        expect(wrapper.find("button").hasClass("btn btn-default")).toBe(true);
        expect(wrapper).toMatchSnapshot();
    });

    it("renders optional icon", () => {
        props = {
            icon: "folder",
            iconStyle: "danger"
        };
        wrapper = shallow(<Button {...props} />);

        const iconComponent = wrapper.find(Icon);

        expect(iconComponent.length).toEqual(1);
        expect(iconComponent.prop("name")).toEqual(props.icon);
        expect(iconComponent.prop("className")).toEqual(`text-${props.iconStyle}`);
        expect(wrapper).toMatchSnapshot();
    });

    it("renders optional children", () => {
        props = {
            children: <div id="tester" />
        };
        wrapper = shallow(<Button {...props} />);
        const childElement = shallow(props.children);

        expect(
            wrapper
                .find("span")
                .children()
                .html()
        ).toEqual(childElement.html());
    });

    it("renders <button> element wrapped in OverlayTrigger when props.tip provided", () => {
        props = {
            tip: "test tip"
        };
        wrapper = shallow(<Button {...props} />);
        const baseButton = shallow(<Button />);

        expect(wrapper.find(OverlayTrigger).length).toEqual(1);
        expect(
            wrapper
                .find(OverlayTrigger)
                .children()
                .html()
        ).toEqual(baseButton.html());
    });

    it("renders optional Tooltip when props.tip provided", () => {
        props = {
            tip: "test_tip"
        };
        wrapper = mount(<Button {...props} />);

        const target = wrapper.find(OverlayTrigger).prop("overlay");

        expect(target.type.name).toEqual("Tooltip");
        expect(target.props.children).toEqual(props.tip);
        expect(wrapper).toMatchSnapshot();
    });

    it("is clickable", () => {
        props = {
            onClick: jest.fn()
        };
        wrapper = shallow(<Button {...props} />);

        wrapper.simulate("click");

        expect(props.onClick).toHaveBeenCalled();
    });
});
