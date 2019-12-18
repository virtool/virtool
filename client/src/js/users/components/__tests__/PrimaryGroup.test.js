import { mapStateToProps, mapDispatchToProps, PrimaryGroup } from "../PrimaryGroup";

describe("<PrimaryGroup />", () => {
    const props = {
        onSetPrimaryGroup: jest.fn(),
        detail: { id: "foo" },
        groups: { foo: "bar" },
        primary_group: "fee"
    };

    it("should render", () => {
        const wrapper = shallow(<PrimaryGroup {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("mapStateToProps", () => {
    const state = {
        users: {
            detail: { group: "foo", primary_group: "bar" }
        }
    };
    it("should return props", () => {
        const result = mapStateToProps(state);
        expect(result).toEqual({
            group: "foo",
            primary_group: "bar"
        });
    });
});
describe("mapDispatchToProps", () => {
    it("should return editUser in props ", () => {
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
