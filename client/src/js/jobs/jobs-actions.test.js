import {
    wsUpdateJob,
    wsRemoveJob,
    findJobs,
    getJob,
    cancelJob,
    removeJob,
    clearJobs,
    getResources
} from "./actions";
import {
    WS_UPDATE_JOB,
    WS_REMOVE_JOB,
    FIND_JOBS,
    GET_JOB,
    CANCEL_JOB,
    REMOVE_JOB,
    CLEAR_JOBS,
    GET_RESOURCES
} from "../actionTypes";

describe("Jobs Action Creators:", () => {

    it("wsUpdateJob: returns action for job update via websocket", () => {
        const data = {};
        const result = wsUpdateJob(data);
        const expected = {
            type: "WS_UPDATE_JOB",
            data
        };

        expect(result).toEqual(expected);
    });

    it("wsRemoveJob: returns action for job removal via websocket", () => {
        const jobId = "tester";
        const result = wsRemoveJob(jobId);
        const expected = {
            type: "WS_REMOVE_JOB",
            jobId
        };

        expect(result).toEqual(expected);
    });

    it("findJobs: returns simple action", () => {
        const result = findJobs();
        const expected = {
            type: "FIND_JOBS_REQUESTED"
        };

        expect(result).toEqual(expected);
    });

    it("getJob: returns action for getting a specific job", () => {
        const jobId = "tester";
        const result = getJob(jobId);
        const expected = {
            type: "GET_JOB_REQUESTED",
            jobId
        };

        expect(result).toEqual(expected);
    });

    it("cancelJob: returns action for cancelling running job", () => {
        const jobId = "tester";
        const result = cancelJob(jobId);
        const expected = {
            type: "CANCEL_JOB_REQUESTED",
            jobId
        };

        expect(result).toEqual(expected);
    });

    it("removeJob: returns action for removing a specific job", () => {
        const jobId = "tester";
        const result = removeJob(jobId);
        const expected = {
            type: "REMOVE_JOB_REQUESTED",
            jobId
        };

        expect(result).toEqual(expected);
    });

    it("clearJobs: returns action to clear a subset of jobs", () => {
        const scope = "filter";
        const result = clearJobs(scope);
        const expected = {
            type: "CLEAR_JOBS_REQUESTED",
            scope
        };

        expect(result).toEqual(expected);
    });

    it("getResources: returns action to retrieve computing resources data", () => {
        const result = getResources();
        const expected = {
            type: "GET_RESOURCES_REQUESTED"
        };

        expect(result).toEqual(expected);
    });

});
