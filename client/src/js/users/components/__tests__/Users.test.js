import { ManageUsers } from "../Users";

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
});
