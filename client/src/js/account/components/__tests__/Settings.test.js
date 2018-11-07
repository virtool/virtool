import { Checkbox } from "../../../base/index";
import * as actions from "../../actions";
import AccountSettings from "../Settings";

describe("<Settings />", () => {
    let wrapper;
    let initialState;

    beforeAll(() => {
        initialState = {
            account: {
                settings: {
                    show_ids: false,
                    skip_quick_analyze_dialog: false
                }
            }
        };
        const store = mockStore(initialState);
        wrapper = shallow(<AccountSettings store={store} />).dive();
    });

    it("renders correctly", () => {
        expect(wrapper).toMatchSnapshot();
    });

    describe("clicking on click targets calls dispatch function", () => {
        let spyDispatch;
        let expected;

        beforeAll(() => {
            spyDispatch = sinon.spy(actions, "updateAccountSettings");
        });

        afterAll(() => {
            spyDispatch.restore();
        });

        beforeEach(() => {
            spyDispatch.resetHistory();
        });

        it("'Show Unique ID Fields' checkbox", () => {
            expect(
                wrapper
                    .find(Checkbox)
                    .at(0)
                    .exists()
            ).toBe(true);

            const checkboxWrapper = wrapper
                .find(Checkbox)
                .at(0)
                .shallow();
            checkboxWrapper.simulate("click");

            expected = {
                show_ids: !initialState.account.settings.show_ids
            };

            expect(spyDispatch.calledWith(expected)).toBe(true);
        });
    });
});
