import { computeMaximums, maxResourcesSelector, minResourcesSelector, checkTaskUpperLimits } from "../selectors";

describe("Selectors tests", () => {
    const state = {
        jobs: {
            resources: {
                mem: { total: 1073741824, available: 500 },
                proc: [10, 15, 20]
            }
        },
        settings: {
            data: {
                create_sample_inst: 10,
                create_sample_mem: 2,
                create_sample_proc: 2,
                build_index_inst: 10,
                build_index_mem: 3,
                build_index_proc: 3,
                create_subtraction_inst: 10,
                create_subtraction_mem: 4,
                create_subtraction_proc: 4,
                pathoscope_bowtie_inst: 10,
                pathoscope_bowtie_mem: 5,
                pathoscope_bowtie_proc: 5,
                nuvs_inst: 10,
                nuvs_mem: 6,
                nuvs_proc: 6,
                proc: 7,
                mem: 7
            }
        }
    };
    let result;
    let expected;

    it("computeMaximums: computes max processor and max memory values", () => {
        result = computeMaximums(state.jobs.resources);
        expected = { maxProc: 3, maxMem: 1 };
        expect(result).toEqual(expected);

        result = computeMaximums(null);
        expected = { maxProc: 1, maxMem: 1 };
        expect(result).toEqual(expected);
    });

    it("maxResourcesSelector: returns max proc and mem values from state", () => {
        result = maxResourcesSelector(state);
        expected = { maxProc: 3, maxMem: 1 };
        expect(result).toEqual(expected);
    });

    it("minResourcesSelector: returns min proc and mem values from state", () => {
        result = minResourcesSelector(state);
        expected = { minProc: 3, minMem: 3 };
        expect(result).toEqual(expected);
    });

    it("checkTaskUpperLimits: returns fields whose values are over the defaults", () => {
        result = checkTaskUpperLimits(state);
        expected = {
            create_sample_mem: 2,
            build_index_mem: 3,
            create_subtraction_mem: 4,
            create_subtraction_proc: 4,
            pathoscope_bowtie_mem: 5,
            pathoscope_bowtie_proc: 5,
            nuvs_mem: 6,
            nuvs_proc: 6
        };
        expect(result).toEqual(expected);

        result = checkTaskUpperLimits({ ...state, jobs: { resources: null } });
        expect(result).toEqual(null);
    });
});
