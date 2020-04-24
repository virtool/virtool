import { Input, Modal } from "../../../base";
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
            id: "foo",
            name: "Prunus persica",
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

    it("should render after name is changed", () => {
        const wrapper = shallow(<EditSubtraction {...props} />);
        expect(wrapper).toMatchSnapshot();
        e.target.name = "name";
        wrapper.find(Input).at(0).simulate("change", e);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render after nickname is changed", () => {
        const wrapper = shallow(<EditSubtraction {...props} />);
        expect(wrapper).toMatchSnapshot();
        e.target.name = "nickname";
        wrapper.find(Input).at(1).simulate("change", e);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onUpdate() when form is submitted", () => {
        const wrapper = shallow(<EditSubtraction {...props} />);
        wrapper.find("form").simulate("submit", e);
        expect(props.onUpdate).toHaveBeenCalledWith("foo", "Prunus persica", "Peach");
        expect(props.onHide).toHaveBeenCalled();
    });

    it("should call onHide() when closed", () => {
        const wrapper = shallow(<EditSubtraction {...props} />);
        wrapper.find(Modal).prop("onHide")();
        expect(props.onHide).toHaveBeenCalledWith();
    });
});

describe("mapDispatchToProps()", () => {
    it("should return updateSubtraction in props", () => {
        const dispatch = jest.fn();
        const props = mapDispatchToProps(dispatch);
        props.onUpdate("foo", "Foo", "Bar");
        expect(dispatch).toHaveBeenCalledWith({
            subtractionId: "foo",
            name: "Foo",
            nickname: "Bar",
            type: "UPDATE_SUBTRACTION_REQUESTED"
        });
    });
});
