import { Select } from "../../../base";
import { mapDispatchToProps, mapStateToProps, PrimaryGroup } from "../PrimaryGroup";

describe("<PrimaryGroup />", () => {
    const props = {
        groups: ["foo", "bar", "baz"],
        id: "bob",
        primaryGroup: "bar",
        onSetPrimaryGroup: jest.fn()
    };

    it("should render", () => {
        const wrapper = shallow(<PrimaryGroup {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onSetPrimaryGroup() when selection changes", () => {
        const wrapper = shallow(<PrimaryGroup {...props} />);
        wrapper.find(Select).simulate("change", { target: { value: "baz" } });
        expect(props.onSetPrimaryGroup).toHaveBeenCalledWith("bob", "baz");
    });
});

describe("mapStateToProps", () => {
    const groups = ["foo", "bar", "baz"];
    const state = {
        users: {
            detail: { id: "bob", groups, primary_group: "bar" }
        }
    };
    it("should return props", () => {
        const result = mapStateToProps(state);
        expect(result).toEqual({
            id: "bob",
            groups,
            primaryGroup: "bar"
        });
    });
});

describe("mapDispatchToProps", () => {
    it("should return onSetPrimaryGroup() in props", () => {
        const dispatch = jest.fn();
        const props = mapDispatchToProps(dispatch);

        props.onSetPrimaryGroup("foo", "bar");

        expect(dispatch).toHaveBeenCalledWith({
            type: "EDIT_USER_REQUESTED",
            update: {
                primary_group: "bar"
            },
            userId: "foo"
        });
    });
});
