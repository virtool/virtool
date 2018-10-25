import { Icon } from "../../base";
import UserEntry from "./Item";

describe("<UserEntry />", () => {
    describe("renders correctly", () => {
        let initialState;
        let store;
        let wrapper;

        it("with admin icon when [isAdmin=true]", () => {
            initialState = {
                users: {
                    list: {
                        documents: [
                            {
                                id: "testid",
                                identicon: "randomhashof15c",
                                administrator: true
                            }
                        ]
                    }
                }
            };
            store = mockStore(initialState);
            wrapper = shallow(<UserEntry store={store} index={0} />).dive();

            expect(wrapper.find(Icon).length).toBe(1);
            expect(wrapper).toMatchSnapshot();
        });

        it("without icon otherwise", () => {
            initialState = {
                users: {
                    list: {
                        documents: [
                            {
                                id: "testid",
                                identicon: "randomhashof15c",
                                administrator: false
                            }
                        ]
                    }
                }
            };
            store = mockStore(initialState);
            wrapper = shallow(<UserEntry store={store} index={0} />).dive();

            expect(wrapper.find(Icon).length).toBe(0);
            expect(wrapper).toMatchSnapshot();
        });
    });
});
