import { CHANGE_ACTIVE_GROUP } from "../../../app/actionTypes";
import { Group, mapDispatchToProps, mapStateToProps } from "../Group";

describe("Group", () => {
    let props;

    beforeEach(() => {
        props = {
            id: "foo",
            active: false,
            onSelect: jest.fn()
        };
    });

    it("should render correct with default props", () => {
        const wrapper = shallow(<Group {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render as active when [active=true]", () => {
        props.active = true;
        const wrapper = shallow(<Group {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onSelect when clicked", () => {
        props.active = true;
        const wrapper = shallow(<Group {...props} />);
        wrapper.simulate("click");
        expect(props.onSelect).toBeCalled();
    });
});

describe("mapStateToProps", () => {
    const state = {
        groups: { activeId: "bar" }
    };

    it("should return [active=true] when active", () => {
        const result = mapStateToProps(state, { id: "bar" });
        expect(result).toEqual({
            active: true
        });
    });

    it("should return [active=false] when not active", () => {
        const result = mapStateToProps(state, { id: "foo" });
        expect(result).toEqual({
            active: false
        });
    });
});

describe("mapDispatchToProps", () => {
    it("should call dispatch with correct action", () => {
        const dispatch = jest.fn();
        const props = mapDispatchToProps(dispatch, { id: "foo" });

        props.onSelect();

        expect(dispatch).toHaveBeenCalledWith({
            type: CHANGE_ACTIVE_GROUP,
            id: "foo"
        });
    });
});
