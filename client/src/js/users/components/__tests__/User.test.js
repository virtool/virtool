import { UserItem } from "../User";

describe("<UserItem />", () => {
    let props;
    let wrapper;

    it("renders correctly", () => {
        props = {
            detail: { identicon: "randomhashof15c" },
            activeUser: "test-user",
            activeUserIsAdmin: true,
            groups: [],
            groupsFetched: true,
            error: "",
            match: { params: { userId: "test-user" } },
            onGetUser: jest.fn(),
            onRemoveUser: jest.fn(),
            onClose: jest.fn(),
            onSetPrimaryGroup: jest.fn(),
            onSetUserRole: jest.fn(),
            onListGroups: jest.fn()
        };
        wrapper = shallow(<UserItem {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});
