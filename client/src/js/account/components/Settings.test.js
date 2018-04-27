import AccountSettings from "./Settings";
import { AlgorithmSelect, Checkbox } from "../../base";
import * as actions from "../actions";

describe("<Settings />", () => {
    let wrapper;
    let initialState;

    beforeAll(() => {
        initialState = {
            account: {
                settings: {
                    show_ids: false,
                    skip_quick_analyze_dialog: false,
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
            expect(wrapper.find(Checkbox).at(0).exists()).toBe(true);

            const checkboxWrapper = wrapper.find(Checkbox).at(0).shallow();
            checkboxWrapper.simulate('click');

            expected = {
                show_ids: !initialState.account.settings.show_ids
            };

            expect(spyDispatch.calledWith(expected)).toBe(true);
        });

        it("'Skip Dialog' checkbox", () => {
            expect(wrapper.find(Checkbox).at(1).exists()).toBe(true);

            const checkboxWrapper = wrapper.find(Checkbox).at(1).shallow();
            checkboxWrapper.simulate('click');

            expected = {
                skip_quick_analyze_dialog: !initialState.account.settings.skip_quick_analyze_dialog
            };

            expect(spyDispatch.calledWith(expected)).toBe(true);
        });

        it("selecting an algorithm from 'Quick Analyze' dropdown", () => {
            const mockEvent = {
                target: {
                    value: "test_algorithm_option"
                }
            };

            expect(wrapper.find(AlgorithmSelect).exists()).toBe(true);

            const algorithmWrapper = wrapper.find(AlgorithmSelect).shallow();
            algorithmWrapper.simulate('change', mockEvent);

            expected = {
                "quick_analyze_algorithm": mockEvent.target.value
            };

            expect(spyDispatch.calledWith(expected)).toBe(true);
        });

    });
});
