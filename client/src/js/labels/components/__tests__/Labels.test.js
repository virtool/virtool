import { Labels, mapDispatchToProps } from "../Labels";
import { PUSH_STATE } from "../../../app/actionTypes";

describe("<Labels>", () => {
    let state;
    let props;
    beforeEach(() => {
        props = {
            onLoadLabels: jest.fn(),
            removeLabel: jest.fn(),
            onHide: jest.fn()
        };
        state = {
            id: ""
        };
    });

    it("should update id on onEdit()", () => {
        const wrapper = shallow(<Labels {...props} />);
        wrapper.setState({ ...state });
        wrapper.instance().onEdit("1");
        expect(wrapper.state()).toEqual({ id: "1" });
    });

    it("should update id on onRemove()", () => {
        const wrapper = shallow(<Labels {...props} />);
        wrapper.setState({ ...state });
        wrapper.instance().onRemove("1", "test");
        expect(wrapper.state()).toEqual({ id: "1", name: "test" });
    });
});

describe("mapDispatchToProps()", () => {
    let dispatch;
    let props;

    beforeEach(() => {
        dispatch = jest.fn();
        props = mapDispatchToProps(dispatch);
    });

    it("should return onLoadLabels() in props", () => {
        props.onLoadLabels();
        expect(dispatch).toHaveBeenCalledWith({ type: "LIST_LABELS_REQUESTED" });
    });

    it("should return removeLabel() in props", () => {
        props.removeLabel("UniqueID");
        expect(dispatch).toHaveBeenCalledWith({
            type: "REMOVE_LABEL_REQUESTED",
            labelId: "UniqueID"
        });
    });

    it("should return onHide in props", () => {
        props.onHide();
        expect(dispatch).toHaveBeenCalledWith({
            type: PUSH_STATE,
            state: {
                removeLabel: false
            }
        });
    });
});
