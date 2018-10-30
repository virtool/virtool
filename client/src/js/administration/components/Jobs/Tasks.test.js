import * as actions from "../../actions";
import TaskLimitsContainer, { TasksFooter, TaskLimits } from "./Tasks";
import Task from "./Task";

describe("<TaskLimits />", () => {
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
        }
    };
    const store = mockStore(initialState);
    let wrapper;

    it("renders correctly", () => {
        wrapper = shallow(<TaskLimitsContainer store={store} />).dive();
        expect(wrapper).toMatchSnapshot();
    });

    it("renders TasksFooter correctly", () => {
        wrapper = shallow(<TasksFooter />);
        expect(wrapper).toMatchSnapshot();
    });

    it("renders TaskLimits correctly", () => {
        const props = {
            limits: {
                create_sample: { proc: 3, mem: 5, inst: 10 },
                build_index: { proc: 3, mem: 5, inst: 10 },
                create_subtraction: { proc: 3, mem: 5, inst: 10 },
                pathoscope_bowtie: { proc: 3, mem: 5, inst: 10 },
                nuvs: { proc: 3, mem: 5, inst: 10 }
            },
            resourceProc: 3,
            resourceMem: 5,
            maxProc: 3,
            maxMem: 5,
            minProc: 3,
            minMem: 5,
            onChangeLimit: jest.fn()
        };
        wrapper = shallow(<TaskLimits {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("dispatches updateSetting when limits are changed", () => {
        const spy = sinon.spy(actions, "updateSetting");
        expect(spy.called).toBe(false);

        wrapper = mount(<TaskLimitsContainer store={store} />);
        wrapper
            .find(Task)
            .at(0)
            .prop("onChangeLimit")("test", "proc", 5);

        expect(spy.calledWith("test_proc", 5)).toBe(true);

        spy.restore();
    });
});
