import { SubtractionList } from "../List";

describe("<SubtractionList />", () => {
    let props;
    let wrapper;

    it("renders correctly", () => {
        props = {
            filter: "test",
            total_count: 1,
            fetched: true,
            ready_host_count: 1,
            page: 1,
            page_count: 1,
            isLoading: false,
            errorLoad: false,
            refetchPage: false,
            documents: ["one", "two", "three"],
            canModify: true,
            onFilter: jest.fn(),
            loadNextPage: jest.fn()
        };
        wrapper = shallow(<SubtractionList {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});
