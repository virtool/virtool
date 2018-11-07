import { RemoveModal } from "../../../../base";
import { RemoveSequence } from "../RemoveSequence";

describe("<RemoveSequence />", () => {
    let props;

    beforeEach(() => {
        props = {
            otuId: "foo",
            isolateId: "bar",
            isolateName: "baz",
            sequenceId: "test",
            onHide: jest.fn(),
            onConfirm: jest.fn()
        };
    });

    it("renders correctly", () => {
        const wrapper = shallow(<RemoveSequence {...props} />).dive();
        expect(wrapper).toMatchSnapshot();
    });

    it("calls onConfirm when remove confirmed", () => {
        const wrapper = mount(<RemoveSequence {...props} />);
        wrapper.find(RemoveModal).prop("onConfirm")();
        expect(props.onConfirm).toBeCalledWith("foo", "bar", "test");
    });

    it("calls onHide when hidden", () => {
        const wrapper = mount(<RemoveSequence {...props} />);
        wrapper.find(RemoveModal).prop("onHide")();
        expect(props.onHide).toBeCalled();
    });
});
