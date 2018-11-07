import { FIND_USERS } from "../../../app/actionTypes";
import { ScrollList } from "../../../base";
import { UsersList, mapStateToProps, mapDispatchToProps } from "../List";

describe("<UsersList />", () => {
    let props;

    beforeEach(() => {
        props = {
            documents: [],
            term: "foo",
            onLoadNextPage: jest.fn(),
            page: 2,
            page_count: 5
        };
    });

    it("renders correctly", () => {
        const wrapper = shallow(<UsersList {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("passes renderRow to <ScrollList />", () => {
        const wrapper = mount(<UsersList {...props} />);
        const renderRow = wrapper.find(ScrollList).prop("onLoadNextPage")(8);
        expect(wrapper.renderRow).toBe(renderRow);
    });

    it("onLoadNextPage is called correctly", () => {
        const wrapper = mount(<UsersList {...props} />);
        wrapper.find(ScrollList).prop("onLoadNextPage")(8);
        expect(props.onLoadNextPage).toBeCalledWith("foo", 8);
    });

    it("mapStateToProps returns props", () => {
        const users = {
            documents: [{ id: "bob" }],
            page: 2,
            page_count: 10,
            term: "foo"
        };
        const props = mapStateToProps({
            users
        });

        expect(props).toEqual(users);
    });

    it("mapDispatchToProps returns onLoadNextPage", () => {
        const dispatch = jest.fn();
        const props = mapDispatchToProps(dispatch);
        const term = "foo";
        const page = 3;

        props.onLoadNextPage(term, page);

        expect(dispatch).toBeCalledWith({
            type: FIND_USERS.REQUESTED,
            term,
            page
        });
    });
});
