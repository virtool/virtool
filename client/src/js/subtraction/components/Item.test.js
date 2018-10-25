import SubtractionItem from "./Item";

describe("<SubtractionItem />", () => {
    let initialState;
    let store;
    let wrapper;

    it("renders correctly when entry is ready", () => {
        initialState = {
            subtraction: {
                documents: [{ id: "123abc", ready: true }]
            }
        };
        store = mockStore(initialState);

        wrapper = shallow(<SubtractionItem store={store} index={0} />).dive();
        expect(wrapper).toMatchSnapshot();
    });

    it("renders correctly when entry is not ready", () => {
        initialState = {
            subtraction: {
                documents: [{ id: "123abc", ready: false }]
            }
        };
        store = mockStore(initialState);

        wrapper = shallow(<SubtractionItem store={store} index={0} />).dive();
        expect(wrapper).toMatchSnapshot();
    });
});
