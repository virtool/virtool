import AccountGeneral from "./General";

describe("<AccountGeneral />", () => {

    it("renders correctly", () => {
        const initialState = {
            account: {
                id: "testid",
                identicon: "randomhash",
                groups: ["test"]
            }
        };
        const store = mockStore(initialState);
        const wrapper = shallow(<AccountGeneral store={store} />).dive();

        expect(wrapper).toMatchSnapshot();
    });

});
