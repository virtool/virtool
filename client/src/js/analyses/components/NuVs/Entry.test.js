import NuVsEntry from "./Entry";

describe("<NuVsEntry />", () => {
    let props;
    let wrapper;

    beforeEach(() => {
        props = {
            in: false,
            index: 0,
            sequence: "test-sequence",
            orfs: [],
            minE: 3,
            toggleIn: sinon.spy()
        };
    });

    it("renders correctly", () => {
        wrapper = shallow(<NuVsEntry {...props} />);
        expect(wrapper).toMatchSnapshot();

        wrapper.setProps({ ...props, in: true });
        expect(wrapper).toMatchSnapshot();
    });

    it("Clicking close button calls toggleIn callback prop", () => {
        expect(props.toggleIn.called).toBe(false);

        props = { ...props, in: true };
        wrapper = shallow(<NuVsEntry {...props} />);

        wrapper.find("button").prop("onClick")();
        expect(props.toggleIn.calledWith(props.index)).toBe(true);
    });

    it("shouldComponentUpdate() returns true if change in props.in, otherwise false", () => {
        const spy = sinon.spy(NuVsEntry.prototype, "shouldComponentUpdate");
        expect(spy.called).toBe(false);

        wrapper = shallow(<NuVsEntry {...props} />);

        wrapper.setProps({ in: props.in });
        expect(spy.returned(false)).toBe(true);

        wrapper.setProps({ in: !props.in });
        expect(spy.returned(true)).toBe(true);

        spy.restore();
    });

    it("handleToggleIn() calls toggleIn callback prop if [in=false]", () => {
        expect(props.toggleIn.called).toBe(false);

        props = { ...props, in: true };
        wrapper = shallow(<NuVsEntry {...props} />);
        wrapper.prop("onClick")();
        expect(props.toggleIn.called).toBe(false);

        wrapper.setProps({ in: false });
        wrapper.prop("onClick")();
        expect(props.toggleIn.calledWith(0)).toBe(true);
    });
});
