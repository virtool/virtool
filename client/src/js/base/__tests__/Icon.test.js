import { Icon } from "../Icon";

describe("<Icon />", () => {
    let props;

    beforeEach(() => {
        props = {
            name: "test"
        };
    });

    it("should render", () => {
        const wrapper = shallow(<Icon {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render tooltip when tip props is defined", () => {
        props.tip = "Tooltip";
        const wrapper = shallow(<Icon {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render placed tooltip when tipPlacement props defined", () => {
        props.tip = "Tooltip";
        props.tipPlacement = "bottom";
        const wrapper = shallow(<Icon {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when className prop provided", () => {
        props.className = "heavy";
        const wrapper = shallow(<Icon {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [fixedWith=true]", () => {
        const wrapper = shallow(<Icon {...props} fixedWidth />);
        expect(wrapper).toMatchSnapshot();
    });
});
