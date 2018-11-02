import { RemoveModal } from "../../../base";
import { RemoveSample } from "../Remove";

describe("<Remove />", () => {
    let props;

    beforeEach(() => {
        props = {
            id: "foo",
            name: "test",
            show: true,
            onHide: jest.fn(),
            onConfirm: jest.fn()
        };
    });

    it("renders when [show=true]", () => {
        const wrapper = shallow(<RemoveSample {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("renders when [show=false]", () => {
        props.show = false;
        const wrapper = shallow(<RemoveSample {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("calls onConfirm() with id when confirmed", () => {
        const wrapper = mount(<RemoveSample {...props} />);
        wrapper.find(RemoveModal).props().onConfirm();
        expect(props.onConfirm).toBeCalledWith("foo");
    });

    it("calls onHide() when RemoveModal.onHide() is called", () => {
        const wrapper = mount(<RemoveSample {...props} />);
        wrapper.find(RemoveModal).props().onHide();
        expect(props.onHide).toBeCalled();
    });


});
