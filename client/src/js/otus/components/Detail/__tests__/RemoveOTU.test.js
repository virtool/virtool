import { HIDE_OTU_MODAL, REMOVE_OTU } from "../../../../app/actionTypes";
import { RemoveOTU, mapStateToProps, mapDispatchToProps } from "../RemoveOTU";

describe("<RemoveOTU />", () => {
    let props;

    beforeEach(() => {
        props = {
            history: {},
            id: "foo",
            name: "Foo",
            refId: "baz",
            show: true,
            onConfirm: jest.fn(),
            onHide: jest.fn()
        };
    });

    it("should render when [show=true]", () => {
        const wrapper = shallow(<RemoveOTU {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [show=false]", () => {
        const wrapper = shallow(<RemoveOTU {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onConfirm() when onConfirm() called on <RemoveModal />", () => {
        const wrapper = shallow(<RemoveOTU {...props} />);
        wrapper.props().onConfirm();
        expect(props.onConfirm).toHaveBeenCalledWith("baz", "foo", props.history);
    });

    it("should call onHide() when onHide() called on <RemoveModal />", () => {
        const wrapper = shallow(<RemoveOTU {...props} />);
        wrapper.props().onHide();
        expect(props.onHide).toHaveBeenCalled();
    });
});

describe("mapStateToProps()", () => {
    let state;

    beforeEach(() => {
        state = {
            otus: {
                remove: false
            },
            references: {
                detail: {
                    id: "foo"
                }
            }
        };
    });

    it.each([true, false])("should return props when [state.otus.remove=%p]", show => {
        state.otus.remove = show;
        const props = mapStateToProps(state);
        expect(props).toEqual({
            show,
            refId: "foo"
        });
    });
});

describe("mapDispatchToProps()", () => {
    let dispatch;
    let props;

    beforeEach(() => {
        dispatch = jest.fn();
        props = mapDispatchToProps(dispatch);
    });

    it("should return onConfirm() in props", () => {
        const refId = "foo";
        const otuId = "baz";
        const history = {
            id: "bar"
        };
        props.onConfirm(refId, otuId, history);
        expect(dispatch).toHaveBeenCalledWith({
            type: REMOVE_OTU.REQUESTED,
            history,
            otuId,
            refId
        });
    });

    it("should return onHide() in props", () => {
        props.onHide();
        expect(dispatch).toHaveBeenCalledWith({
            type: HIDE_OTU_MODAL
        });
    });
});
