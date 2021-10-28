jest.mock("../../selectors");

import { UserDetail, mapStateToProps, mapDispatchToProps } from "../Detail";
import { getCanModifyUser } from "../../selectors";

describe("<UserDetail />", () => {
    let props;

    beforeEach(() => {
        props = {
            canModifyUser: true,
            match: {
                params: {
                    userId: "foo"
                }
            },
            error: [],
            detail: {
                id: "bob",
                handle: "bob",
                administrator: true
            },
            onGetUser: jest.fn(),
            onRemoveUser: jest.fn(),
            onListGroups: jest.fn()
        };
    });

    it("should render", () => {
        const wrapper = shallow(<UserDetail {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [administrator=false]", () => {
        props.detail.administrator = false;
        const wrapper = shallow(<UserDetail {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [canModifyUser=false]", () => {
        props.canModifyUser = false;
        const wrapper = shallow(<UserDetail {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onGetUser() and onListGroups() on mount", () => {
        expect(props.onGetUser).not.toHaveBeenCalled();
        expect(props.onListGroups).not.toHaveBeenCalled();

        shallow(<UserDetail {...props} />);

        expect(props.onGetUser).toHaveBeenCalledWith("foo");
        expect(props.onListGroups).toHaveBeenCalled();
    });

    it("should call onRemoveUser() when RemoveBanner clicked", () => {
        const wrapper = shallow(<UserDetail {...props} />);
        wrapper.find("RemoveBanner").prop("onClick")();
        expect(props.onRemoveUser).toHaveBeenCalledWith("bob");
    });
});

describe("mapStateToProps", () => {
    const state = {
        users: {
            detail: "foo"
        },
        groups: {
            list: "foo",
            fetched: true
        }
    };

    it.each([true, false])("should return props when [canModifyUser=%p]", canModifyUser => {
        getCanModifyUser.mockReturnValue(canModifyUser);

        const props = mapStateToProps(state);

        expect(props).toEqual({
            canModifyUser,
            detail: "foo",
            error: ""
        });

        expect(getCanModifyUser).toHaveBeenCalledWith(state);
    });
});

describe("mapDispatchToProps", () => {
    let dispatch;
    let result;

    beforeEach(() => {
        dispatch = jest.fn();
        result = mapDispatchToProps(dispatch);
    });

    it("should return onGetUser() in props", () => {
        const userId = "foo";
        result.onGetUser(userId);
        expect(dispatch).toHaveBeenCalledWith({
            type: "GET_USER_REQUESTED",
            userId
        });
    });

    it("should return onListGroups() in props", () => {
        result.onListGroups();
        expect(dispatch).toHaveBeenCalledWith({
            type: "LIST_GROUPS_REQUESTED"
        });
    });

    it("should return onRemoveUser() in props", () => {
        const userId = "foo";
        result.onRemoveUser(userId);
        expect(dispatch).toHaveBeenCalledWith({
            type: "REMOVE_USER_REQUESTED",
            userId
        });
    });
});
