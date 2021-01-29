import { mapDispatchToProps } from "../Labels";

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

    it("should return onHide() in props", () => {
        props.onHide();
        expect(dispatch).toHaveBeenCalledWith({ type: "PUSH_STATE", state: { removeLabel: false } });
    });
});
