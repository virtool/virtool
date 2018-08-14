import ResourcesContainer, {
    getErrorMessage,
    LimitLabel,
    Resources
} from "./Resources";
import { InputError } from "../../../base";
import * as actions from "../../actions";
import * as jobActions from "../../../jobs/actions";
import * as errorActions from "../../../errors/actions";

describe("<Resources />", () => {
    const initialState = {
        jobs: {
            resources: {
                mem: { total: 1000, available: 500 },
                proc: [10, 15, 20]
            }
        },
        settings: {
            data: {
                create_sample_inst: 10,
                create_sample_mem: 5,
                create_sample_proc: 3,
                build_index_inst: 10,
                build_index_mem: 5,
                build_index_proc: 3,
                create_subtraction_inst: 10,
                create_subtraction_mem: 5,
                create_subtraction_proc: 3,
                pathoscope_bowtie_inst: 10,
                pathoscope_bowtie_mem: 5,
                pathoscope_bowtie_proc: 3,
                nuvs_inst: 10,
                nuvs_mem: 5,
                nuvs_proc: 3,
                proc: 3,
                mem: 5
            }
        },
        error: null
    };
    const store = mockStore(initialState);
    let props;
    let wrapper;

    it("renders correctly", () => {
        wrapper = shallow(<ResourcesContainer store={store} />).dive();
        expect(wrapper).toMatchSnapshot();
    });

    it("getErrorMessage(): returns error message when [isError=true], otherwise returns false", () => {
        let result = getErrorMessage(true, 1, 10);
        const expected = "Value must be between 1 and 10";
        expect(result).toEqual(expected);

        result = getErrorMessage(false, 1, 10);
        expect(result).toEqual(null);
    });

    it("renders LimitLabel subcomponent", () => {
        props = {
            label: "test",
            available: 5,
            unit: "GB"
        };
        wrapper = shallow(<LimitLabel {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("renders Resources component and calls onGet prop on mount", () => {
        props = {
            onGet: jest.fn(),
            proc: 3,
            mem: 5,
            minProc: 1,
            mimMem: 1,
            maxProc: 8,
            maxMem: 10,
            resources: {
                mem: { total: 1000, available: 500 },
                proc: [10, 15, 20]
            },
            error: "",
            overResourceMax: {}
        };
        wrapper = shallow(<Resources {...props} />);

        expect(wrapper).toMatchSnapshot();
        expect(props.onGet).toHaveBeenCalled();
    });

    describe("dispatch functions", () => {
        let spy;
        let mockEvent;

        afterEach(() => {
            spy.restore();
        });

        it("calls updateSetting() on input submit", () => {
            spy = sinon.spy(actions, "updateSetting");
            expect(spy.called).toBe(false);

            wrapper = mount(<ResourcesContainer store={store} />);

            mockEvent = {
                name: "test",
                value: 5,
                max: 10,
                min: 1
            };
            wrapper.find(InputError).at(0).prop("onSave")(mockEvent);

            expect(spy.calledWith("test", 5)).toBe(true);
        });

        it("calls getResources() on componentDidMount", () => {
            spy = sinon.spy(jobActions, "getResources");
            expect(spy.called).toBe(false);

            wrapper = mount(<ResourcesContainer store={store} />);

            expect(spy.calledOnce).toBe(true);
        });

        it("calls clearError() to clear error in state and in store on input change", () => {
            spy = sinon.spy(errorActions, "clearError");
            expect(spy.called).toBe(false);

            wrapper = mount(<ResourcesContainer store={store} />);

            mockEvent = {
                preventDefault: jest.fn(),
                target: { name: "test" }
            };
            wrapper.find(InputError).at(0).prop("onChange")(mockEvent);

            expect(spy.calledWith("UPDATE_SETTINGS_ERROR")).toBe(true);
        });

    });

});
