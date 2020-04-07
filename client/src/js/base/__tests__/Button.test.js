import { Tooltip } from "../Tooltip";
import { Button } from "../Button";
import { Icon } from "../Icon";

describe("<Button2 />", () => {
    let props;
    let wrapper;

    it("renders correctly", () => {
        wrapper = shallow(<Button {...props} />);

        expect(wrapper).toMatchSnapshot();
    });

    it("renders optional icon", () => {
        props = { icon: "folder", iconStyle: "danger" };
        wrapper = shallow(<Button {...props} />);

        const iconComponent = wrapper.find(Icon);

        expect(iconComponent.length).toEqual(1);
        expect(iconComponent.prop("name")).toEqual(props.icon);
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

    it("renders <button> element wrapped in Tooltip when props.tip provided", () => {
        props = {
            tip: "test tip"
        };
        wrapper = shallow(<Button {...props} />);
        const baseButton = shallow(<Button />);

        expect(wrapper.find(Tooltip).length).toEqual(1);
        expect(
            wrapper
                .find(Tooltip)
                .children()
                .html()
        ).toEqual(baseButton.html());
    });

    it("renders optional Tooltip when props.tip provided", () => {
        props = {
            tip: "test_tip"
        };
        wrapper = shallow(<Button {...props} />);

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
