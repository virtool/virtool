import { RemoveModal } from "../RemoveModal";
import { Button } from "../Button";

describe("<RemoveModal />", () => {
    let props;
    let wrapper;

    it("renders correctly", () => {
        wrapper = shallow(<RemoveModal />);
        expect(wrapper).toMatchSnapshot();
    });

    it("renders a ModalDialog component when [show=true]", () => {
        wrapper = shallow(<RemoveModal show={true} />);

        expect(wrapper.find("ModalDialog").exists()).toBe(true);
        expect(wrapper).toMatchSnapshot();
    });

    it("clicking the close button results in calling the onConfirm prop function", () => {
        props = {
            show: true,
            onConfirm: jest.fn()
        };
        wrapper = shallow(<RemoveModal {...props} />);

        wrapper
            .find(Button)
            .at(0)
            .simulate("click");

        expect(props.onConfirm).toHaveBeenCalled();
    });

    it("DialogBody displays the name prop", () => {
        props = {
            name: "test-name",
            show: true,
            onHide: jest.fn()
        };
        wrapper = shallow(<RemoveModal {...props} />);

        expect(wrapper.find("strong").text()).toEqual(props.name);

        const message = (
            <span>
                Remove <strong>test-name-2</strong>
            </span>
        );
        wrapper = shallow(<RemoveModal {...props} message={message} />);

        expect(wrapper.find("strong").text()).toEqual("test-name-2");
    });

    it("DialogBody renders a confirmation button", () => {
        props = {
            show: true
        };
        wrapper = shallow(<RemoveModal {...props} />);

        expect(wrapper.find(Button).length).toEqual(1);
        expect(wrapper.find(Button)).toMatchSnapshot();
    });

    it("confirmation Button component calls the onClick prop function when clicked", () => {
        props = {
            show: true,
            onConfirm: jest.fn()
        };
        wrapper = shallow(<RemoveModal {...props} />);

        wrapper.find(Button).simulate("click");

        expect(props.onConfirm).toHaveBeenCalled();
    });
});
