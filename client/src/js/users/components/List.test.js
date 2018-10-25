import * as actions from "../actions";
import List from "./List";

describe("<UsersList />", () => {
    const initialState = {
        users: {
            list: {
                documents: [{ id: "123abc" }],
                page: 1,
                page_count: 1
            },
            fetched: true,
            refetchPage: true,
            isLoading: false,
            errorLoad: false
        }
    };
    const store = mockStore(initialState);
    let wrapper;
    let spy;

    it("renders correctly", () => {
        wrapper = shallow(<List store={store} />).dive();
        expect(wrapper).toMatchSnapshot();
    });

    it("Scrolling list dispatches next page", () => {
        spy = sinon.spy(actions, "listUsers");
        expect(spy.called).toBe(false);

        wrapper = shallow(<List store={store} />);
        wrapper.find({ page: 1 }).prop("loadNextPage")(1);

        expect(spy.calledWith(1)).toBe(true);
        spy.restore();
    });
});
