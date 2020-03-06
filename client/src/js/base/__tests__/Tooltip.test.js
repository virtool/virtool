import { Tooltip } from "../Tooltip";

describe("<Tooltip />", () => {
    const props = {
        tip: "foo",
        position: "bar",
        children: { Foo: "Bar" }
    };

    it("renders correctly", () => {
        const wrapper = shallow(<Tooltip />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when tip prop is provided", () => {
        props.title = "test-header";
        const wrapper = shallow(<Tooltip {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when position tip is provided", () => {
        props.position = "bottom";
        const wrapper = shallow(<Tooltip {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});
