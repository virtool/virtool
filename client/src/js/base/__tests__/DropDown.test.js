import { DropDown } from "../DropDown";

describe("<DropDown />", () => {
    const props = {
        menuName: "foo",
        children: { Foo: "Bar" }
    };

    it("should render", () => {
        const wrapper = shallow(<DropDown {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("handleClick() should update state", () => {
        const wrapper = shallow(<DropDown {...props} />);
        wrapper.find("a").simulate("click");
        expect(wrapper.state()).toEqual({
            visible: true
        });
    });

    it("handleBlur() should update state", () => {
        const wrapper = shallow(<DropDown {...props} />);
        wrapper.find("a").simulate("blur");
        expect(wrapper.state()).toEqual({
            visible: false
        });
    });
});
