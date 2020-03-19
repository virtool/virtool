import { Input, ModalDialog } from "../../../base";
import { EditSubtraction, mapDispatchToProps } from "../Edit";
describe("<EditSubtraction />", () => {
    let e;
    let props;

    beforeEach(() => {
        e = {
            preventDefault: jest.fn(),
            target: {
                value: "Foo"
            }
        };

        props = {
            id: "Prunus persica",
            nickname: "Peach",
            show: true,
            onHide: jest.fn(),
            onUpdate: jest.fn()
        };
    });

    it("should render", () => {
        const wrapper = shallow(<EditSubtraction {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [show=false]", () => {
        props.show = false;
        const wrapper = shallow(<EditSubtraction {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render after nickname is changed", () => {
        const wrapper = shallow(<EditSubtraction {...props} />);
        expect(wrapper).toMatchSnapshot();
        wrapper.find(Input).simulate("change", e);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onUpdate() when form is submitted", () => {
        const wrapper = shallow(<EditSubtraction {...props} />);
        wrapper.find("form").simulate("submit", e);
        expect(props.onUpdate).toHaveBeenCalledWith("Prunus persica", "Peach");
        expect(props.onHide).toHaveBeenCalled();
    });

    it("should call onHide() when closed", () => {
        const wrapper = shallow(<EditSubtraction {...props} />);
        wrapper.find(ModalDialog).prop("onHide")();
        expect(props.onHide).toHaveBeenCalledWith();
    });
});

describe("mapDispatchToProps()", () => {
    it("should return updateSubtraction in props", () => {
        const dispatch = jest.fn();
        const props = mapDispatchToProps(dispatch);
        props.onUpdate("foo", "bar");
        expect(dispatch).toHaveBeenCalledWith({
            subtractionId: "foo",
            nickname: "bar",
            type: "UPDATE_SUBTRACTION_REQUESTED"
        });
    });
});
