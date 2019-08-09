jest.mock("../../../utils/utils");

import { push } from "connected-react-router";
import { REMOVE_SUBTRACTION } from "../../../app/actionTypes";
import { RemoveSubtraction, mapStateToProps, mapDispatchToProps } from "../Remove";
import { routerLocationHasState } from "../../../utils/utils";

describe("<RemoveSubtraction />", () => {
    let props;

    beforeEach(() => {
        props = {
            show: true,
            id: "foo",
            onHide: jest.fn(),
            onConfirm: jest.fn()
        };
    });

    it.each([true, false])("should render when [show=%p]", show => {
        props.show = show;
        const wrapper = shallow(<RemoveSubtraction {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onConfirm() when onConfirm() on <RemoveModal /> is called", () => {
        const wrapper = shallow(<RemoveSubtraction {...props} />);
        wrapper.props().onConfirm();
        expect(props.onConfirm).toHaveBeenCalledWith("foo");
    });

    it("should call onHide() when onHide() on <RemoveModal /> is called", () => {
        const wrapper = shallow(<RemoveSubtraction {...props} />);
        wrapper.props().onHide();
        expect(props.onHide).toHaveBeenCalled();
    });
});

describe("mapStateToProps()", () => {
    it.each([true, false])("should return props when routerLocationHasState() returns %p", show => {
        routerLocationHasState.mockReturnValue(show);
        const props = mapStateToProps({});
        expect(props).toEqual({
            show
        });
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
        expect(dispatch).toHaveBeenCalledWith(push({ state: { removeSubtraction: false } }));
    });

    it("should return onConfirm() in props", () => {
        props.onConfirm("foo");
        expect(dispatch).toHaveBeenCalledWith({
            type: REMOVE_SUBTRACTION.REQUESTED,
            subtractionId: "foo"
        });
    });
});
