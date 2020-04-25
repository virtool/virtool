import { RemoveSegment, mapStateToProps } from "../Remove";

describe("<RemoveSegment />", () => {
    const props = {
        activeName: "bar",
        show: true,
        onHide: jest.fn(),
        onSubmit: jest.fn(),
        schema: [{ name: "foo" }, { name: "bar" }, { name: "baz" }]
    };

    it("should render when [show=true]", () => {
        const wrapper = shallow(<RemoveSegment {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [show=false]", () => {
        props.show = false;
        const wrapper = shallow(<RemoveSegment {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onSubmit() when onConfirm() called on <RemoveModal />", () => {
        const wrapper = shallow(<RemoveSegment {...props} />);
        wrapper.props().onConfirm();
        expect(props.onSubmit).toHaveBeenCalledWith([{ name: "foo" }, { name: "baz" }]);
    });

    it("should call onHide() when onHide() called on <RemoveModal />", () => {
        const wrapper = shallow(<RemoveSegment {...props} />);
        wrapper.props().onHide();
        expect(props.onHide).toHaveBeenCalled();
    });
});

describe("mapStateToProps()", () => {
    it("should return props given state", () => {
        const schema = [{ name: "Foo" }, { name: "Bar" }];
        const state = {
            otus: {
                detail: {
                    schema
                }
            }
        };
        const result = mapStateToProps(state);
        expect(result).toEqual({ schema });
    });
});
