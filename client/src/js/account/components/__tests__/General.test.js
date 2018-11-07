import { Icon } from "../../../base/index";
import AccountGeneral from "../General";

describe("<AccountGeneral />", () => {
    describe("renders correctly", () => {
        let initialState;
        let store;
        let wrapper;

        it("with admin icon when [isAdmin=true]", () => {
            initialState = {
                account: {
                    id: "testid",
                    identicon: "randomhashof15c",
                    groups: ["test"],
                    administrator: true
                }
            };
            store = mockStore(initialState);
            wrapper = shallow(<AccountGeneral store={store} />).dive();

            expect(wrapper.find(Icon).length).toBe(1);
            expect(wrapper).toMatchSnapshot();
        });

        it("without icon otherwise", () => {
            initialState = {
                account: {
                    id: "testid",
                    identicon: "randomhashof15c",
                    groups: ["test"],
                    administrator: false
                }
            };
            store = mockStore(initialState);
            wrapper = shallow(<AccountGeneral store={store} />).dive();

            expect(wrapper.find(Icon).length).toBe(0);
            expect(wrapper).toMatchSnapshot();
        });
    });
});
