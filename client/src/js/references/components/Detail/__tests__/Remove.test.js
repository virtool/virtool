jest.mock("../../../../utils/utils");

import { REMOVE_REFERENCE } from "../../../../app/actionTypes";
import { RemoveBanner } from "../../../../base";
import { RemoveReference, mapDispatchToProps, mapStateToProps } from "../Remove";
import { checkRefRight } from "../../../../utils/utils";

describe("<RemoveReference />", () => {
    let props;

    beforeEach(() => {
        props = {
            canRemove: true,
            id: "foo",
            onConfirm: jest.fn()
        };
    });

    it("should render when user has permission", () => {
        const wrapper = shallow(<RemoveReference {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should not render when user does not have permission", () => {
        props.canRemove = false;
        const wrapper = shallow(<RemoveReference {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onConfirm() when confirmed", () => {
        const wrapper = shallow(<RemoveReference {...props} />);
        wrapper.find(RemoveBanner).prop("onClick")();
        expect(props.onConfirm).toHaveBeenCalledWith(props.id);
    });
});

describe("mapStateToProps()", () => {
    it.each([true, false])("should return props when checkRefRight returns %p", canRemove => {
        checkRefRight.mockReturnValue(canRemove);

        const state = {
            references: {
                detail: {
                    id: "bar"
                }
            }
        };

        expect(mapStateToProps(state)).toEqual({
            id: "bar",
            canRemove
        });

        expect(checkRefRight).toHaveBeenCalledWith(state, "remove");
    });
});

describe("mapDispatchToProps", () => {
    it("should return functional props.onConfirm", () => {
        const dispatch = jest.fn();
        const result = mapDispatchToProps(dispatch);
        result.onConfirm("foo");

        expect(dispatch).toHaveBeenCalledWith({
            type: REMOVE_REFERENCE.REQUESTED,
            refId: "foo"
        });
    });
});
