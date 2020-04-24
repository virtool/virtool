import { HIDE_OTU_MODAL, REMOVE_ISOLATE } from "../../../../../app/actionTypes";
import { Remove, mapStateToProps, mapDispatchToProps } from "../Remove";

describe("<Remove />", () => {
    let props;

    beforeEach(() => {
        props = {
            id: "foo",
            name: "Foo",
            nextId: "bar",
            otuId: "baz",
            show: true,
            onConfirm: jest.fn(),
            onHide: jest.fn()
        };
    });

    it("should render with [show=true]", () => {
        const wrapper = shallow(<Remove {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render with [show=false]", () => {
        props.show = false;
        const wrapper = shallow(<Remove {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onConfirm() when onConfirm() on <RemoveModal /> is called", () => {
        const wrapper = shallow(<Remove {...props} />);
        wrapper.props().onConfirm();
        expect(props.onConfirm).toHaveBeenCalledWith(props.otuId, props.id, props.nextId);
    });

    it("should call onHide() when onHide() on <RemoveModal /> is called", () => {
        const wrapper = shallow(<Remove {...props} />);
        wrapper.props().onHide();
        expect(props.onHide).toHaveBeenCalled();
    });
});

describe("mapStateToProps()", () => {
    let state;
    let expected;

    beforeEach(() => {
        state = {
            otus: {
                activeIsolate: {
                    id: "foo",
                    name: "Foo"
                },
                detail: {
                    id: "baz",
                    isolates: [{ id: "bar" }]
                },
                removeIsolate: false
            }
        };
        expected = {
            id: "foo",
            name: "Foo",
            nextId: "bar",
            otuId: "baz",
            show: false
        };
    });

    it.each([true, false])("should return props when [state.otus.removeIsolate=%p]", show => {
        state.otus.removeIsolate = show;
        const result = mapStateToProps(state);
        expect(result).toEqual({ ...expected, show });
    });

    it("should return props when no isolates available", () => {
        state.otus.detail.isolates = [];
        const result = mapStateToProps(state);
        expect(result).toEqual({ ...expected, nextId: null });
    });
});

describe("mapDispatchToProps", () => {
    let dispatch;
    let props;

    beforeEach(() => {
        dispatch = jest.fn();
        props = mapDispatchToProps(dispatch);
    });

    it("should return onHide() in props", () => {
        props.onHide();
        expect(dispatch).toHaveBeenCalledWith({
            type: HIDE_OTU_MODAL
        });
    });

    it("should return onConfirm() in props", () => {
        props.onConfirm("foo", "bar", "baz");
        expect(dispatch).toHaveBeenCalledWith({
            type: REMOVE_ISOLATE.REQUESTED,
            otuId: "foo",
            isolateId: "bar",
            nextIsolateId: "baz"
        });
    });
});
