import { ListGroupItem as BsListGroupItem } from "react-bootstrap";
import { ListGroupItem } from "./ListGroupItem";

describe("<ListGroupItem />", () => {
    let props;
    let wrapper;

    it("renders correctly", () => {
        const childElement = <div>Test</div>;
        wrapper = shallow(<ListGroupItem>${childElement}</ListGroupItem>);

        expect(wrapper).toMatchSnapshot();
    });

    it("renders a simple extension of ListGroupItem from react-bootstrap", () => {
        props = {
            children: <div>Test</div>
        };
        wrapper = shallow(<ListGroupItem {...props} />);

        expect(wrapper.find(BsListGroupItem).length).toEqual(1);
        expect(wrapper.prop("onFocus")).toBeDefined();
    });

    it("should let subcomponent focus/blur when prop allowFocus is supplied", () => {
        const handleFocus = jest.fn();
        props = {
            allowFocus: true,
            children: <div onFocus={handleFocus} />
        };
        wrapper = mount(<ListGroupItem {...props} />);
        const spyFocusHandler = jest.spyOn(wrapper.instance(), "handleFocus");
        wrapper.instance().forceUpdate();

        wrapper.find("div").simulate("focus");

        expect(spyFocusHandler).not.toHaveBeenCalled();
        expect(handleFocus).toHaveBeenCalled();

        spyFocusHandler.mockReset();
        spyFocusHandler.mockRestore();
    });

    it("should not let subcomponent focus/blur when allowFocus props is not supplied", () => {
        const handleFocus = jest.fn();
        props = {
            allowFocus: false,
            children: <div onFocus={handleFocus} />
        };
        wrapper = mount(<ListGroupItem {...props} />);
        const spyFocusHandler = jest.spyOn(wrapper.instance(), "handleFocus");
        wrapper.instance().forceUpdate();

        wrapper.simulate("focus");

        expect(spyFocusHandler).toHaveBeenCalled();
        expect(handleFocus).not.toHaveBeenCalled();

        spyFocusHandler.mockReset();
        spyFocusHandler.mockRestore();
    });
});
