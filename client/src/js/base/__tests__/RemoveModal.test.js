import { ModalDialog } from "../Modal";
import { RemoveModal } from "../RemoveModal";
import { Button } from "../Button";

describe("<RemoveModal />", () => {
    let props;

    beforeEach(() => {
        props = {
            name: "Foo",
            noun: "bar",
            show: true,
            onConfirm: jest.fn(),
            onHide: jest.fn()
        };
    });

    it("should render", () => {
        const wrapper = shallow(<RemoveModal {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [show=false]", () => {
        props.show = false;
        const wrapper = shallow(<RemoveModal {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render with message", () => {
        props.message = "Are you sure about this?";
        const wrapper = shallow(<RemoveModal {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call the onHide() prop when ModalDialogclose.onHide() is called", () => {
        const wrapper = shallow(<RemoveModal {...props} />);
        wrapper.find(ModalDialog).prop("onHide")();
        expect(props.onHide).toHaveBeenCalled();
    });

    it("should call the onConfirm() prop when confirmation button clicked", () => {
        const wrapper = shallow(<RemoveModal {...props} />);
        wrapper.find(Button).simulate("click");
        expect(props.onConfirm).toHaveBeenCalled();
    });
});
