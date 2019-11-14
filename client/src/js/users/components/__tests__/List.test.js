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

    it("should render", () => {
        const wrapper = shallow(<UsersList {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onLoadNextPage() on mount", () => {
        const wrapper = mount(<UsersList {...props} />);
        wrapper.find(ScrollList).prop("onLoadNextPage")(1);
    });

    it("should call onLoadNextPage() when paged", () => {
        const wrapper = mount(<UsersList {...props} />);
        wrapper.find(ScrollList).prop("onLoadNextPage")(8);
        expect(props.onLoadNextPage).toHaveBeenCalledWith("foo", 8);
    });
});

describe("mapStateToProps()", () => {
    it("should return props", () => {
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
});

describe("mapDispatchToProps()", () => {
    it("should return onLoadNextPage() in props", () => {
        const dispatch = jest.fn();
        const props = mapDispatchToProps(dispatch);
        const term = "foo";
        const page = 3;

        props.onLoadNextPage(term, page);

        expect(dispatch).toHaveBeenCalledWith({
            type: FIND_USERS.REQUESTED,
            term,
            page
        });
    });
});
