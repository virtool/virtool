import { ManageUsers, mapStateToProps, mapDispatchToProps } from "../Users";

describe("<ManageUsers />", () => {
    let props;
    let wrapper;

    it("renders correctly", () => {
        props = {
            isAdmin: true,
            filter: "test",
            groups: [],
            groupsFetched: true,
            error: "",
            onFilter: jest.fn(),
            onClearError: jest.fn(),
            onListGroups: jest.fn()
        };
        wrapper = shallow(<ManageUsers {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when componentDidMount is called", () => {
        props.groupsFetched = false;
        shallow(<ManageUsers {...props} />);

        expect(props.onListGroups).toHaveBeenCalled();
    });

    it("should render when componentWillUnmount is called", () => {
        props.error = ["foo"];
        const wrapper = shallow(<ManageUsers {...props} />);
        wrapper.unmount();
        expect(props.onClearError).toHaveBeenCalledWith("LIST_USERS_ERROR");
    });
});

describe("mapStateToProps", () => {
    const state = {
        account: {
            administrator: true
        },
        users: {
            filter: "foo"
        },
        groups: {
            list: "bar",
            fetched: true
        }
    };
    const result = mapStateToProps(state);
    expect(result).toEqual({
        isAdmin: true,
        term: "foo",
        groups: "bar",
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

    it("should return onFind in props", () => {
        const e = {
            target: {
                value: "foo"
            }
        };
        result.onFind(e);
        expect(dispatch).toHaveBeenCalledWith({
            page: 1,
            term: "foo",
            type: "FIND_USERS_REQUESTED"
        });
    });

    it("should return onClearError in props", () => {
        const error = "foo";
        result.onClearError(error);
        expect(dispatch).toHaveBeenCalledWith({
            error: "foo",
            type: "CLEAR_ERROR"
        });
    });

    it("should return onListGroups in props", () => {
        result.onListGroups();
        expect(dispatch).toHaveBeenCalled();
    });
});
