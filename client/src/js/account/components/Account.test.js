import Account from "./Account";

describe("<Account />", () => {

    it("renders correctly", () => {
        const initialState = {
            account: {}
        };
        const store = mockStore(initialState);

        const wrapper = shallow(<Account store={store} />).dive();

        expect(wrapper).toMatchSnapshot();
    });
});
