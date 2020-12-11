import { CreateLabel } from "../CreateLabel";
import { Modal } from "../../../../base";

describe("<CreateLabel>", () => {
    let props;
    beforeEach(() => {
        props = {
            labelName: "Foobar",
            color: "#FFF000",
            description: "FooDesc",
            show: false,
            onHide: jest.fn()
        };
    });

    it("should render when [show=false]", () => {
        const wrapper = shallow(<CreateLabel {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [show=true]", () => {
        props.show = true;
        const wrapper = shallow(<CreateLabel {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onHide() when CreateLabel.onHide() is called", () => {
        const wrapper = shallow(<CreateLabel {...props} />);
        wrapper.find(Modal).props().onHide();
        expect(props.onHide).toHaveBeenCalled();
    });
});
