import { EditLabel } from "../EditLabel";
import { Modal } from "../../../../base";

describe("<EditLabel>", () => {
    let props;
    beforeEach(() => {
        props = {
            id: "foobar",
            description: "BarFoo",
            color: "#3C8786",
            show: false,
            onHide: jest.fn()
        };
    });

    it("should render when [show=false]", () => {
        const wrapper = shallow(<EditLabel {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [show=true]", () => {
        props.show = true;
        const wrapper = shallow(<EditLabel {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onHide() when EditLabel.onHide() is called", () => {
        const wrapper = shallow(<EditLabel {...props} />);
        wrapper.find(Modal).props().onHide();
        expect(props.onHide).toHaveBeenCalled();
    });
});
