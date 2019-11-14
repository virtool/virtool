import { UserDetail, mapStateToProps, mapDispatchToProps } from "../Detail";

describe("<UserDetail />", () => {
    let props;

    beforeEach(() => {
        props = {
            onGetUser: jest.fn(),
            match: {
                params: {
                    userId: "foo"
                }
            },
            groupsFetched: true,
            onListGroups: jest.fn(),
            onSetUserRole: jest.fn(),
            detail: {
                id: "foo",
                groups: "bar",
                administrator: "baz",
                identicon: "foo",
                primary_group: "Bar",
                permissions: { foo: "bar" }
            },
            onRemoveUser: jest.fn(),
            error: []
        };
    });

    it("should render", () => {
        const wrapper = shallow(<UserDetail {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("componentDidMount should call onGetUser", () => {
        expect(props.onGetUser).not.toHaveBeenCalled();
        shallow(<UserDetail {...props} />);
        expect(props.onGetUser).toHaveBeenCalledWith("foo");
    });

    it("componentDidMount should call onListGroups", () => {
        expect(props.onListGroups).not.toHaveBeenCalled();
    });
    it("componentDidMount should not call onListGroups when [props.groupsFetched = false]", () => {
        props.groupsFetched = false;
        shallow(<UserDetail {...props} />);
        expect(props.onListGroups).toHaveBeenCalled();
    });
});

describe("mapStateToProps", () => {
    const state = {
        users: {
            detail: "foo"
        },
        account: {
            id: "foo",
            administrator: true
        },
        groups: {
            list: "foo",
            fetched: true
        }
    };

    const props = mapStateToProps(state);
    expect(props).toEqual({
        detail: "foo",
        activeUser: "foo",
        activeUserIsAdmin: true,
        groups: "foo",
        groupsFetched: true,
        error: ""
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
    it("should return onRemoveUser() in props", () => {
        const userId = "foo";
        result.onRemoveUser(userId);
        expect(dispatch).toHaveBeenCalledWith({
            type: "REMOVE_USER_REQUESTED",
            userId
        });
    });
    it("should return onClose() in props", () => {
        result.onClose();
        expect(dispatch).toHaveBeenCalledWith({
            type: "@@router/CALL_HISTORY_METHOD",
            payload: { args: ["/administration/users"], method: "push" }
        });
    });
    it("should return onSetPrimaryGroup() in props", () => {
        const userId = "foo";
        const groupId = "bar";
        result.onSetPrimaryGroup(userId, groupId);
        expect(dispatch).toHaveBeenCalledWith({
            type: "EDIT_USER_REQUESTED",
            update: { primary_group: "bar" },
            userId: "foo"
        });
    });
    it("should return onSetUserRole() in props", () => {
        const userId = "foo";
        const isAdmin = true;
        result.onSetUserRole(userId, isAdmin);
        expect(dispatch).toHaveBeenCalledWith({
            type: "EDIT_USER_REQUESTED",
            update: {
                administrator: true
            },
            userId: "foo"
        });
    });
    it("should return onListGroups() in props", () => {
        result.onListGroups();
        expect(dispatch).toHaveBeenCalledWith({
            type: "LIST_GROUPS_REQUESTED"
        });
    });
});
