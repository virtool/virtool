import Account from "../Account";

describe("<Account />", () => {
    it("renders correctly", () => {
        const store = mockStore({});
        const wrapper = shallow(<Account store={store} />).dive();

        expect(wrapper).toMatchSnapshot();
    });
});
