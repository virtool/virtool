import {
    WS_INSERT_JOB,
    WS_UPDATE_JOB,
    WS_REMOVE_JOB,
    GET_JOB,
    CANCEL_JOB,
    REMOVE_JOB,
    CLEAR_JOBS,
    GET_RESOURCES
} from "../actionTypes";
import {
    wsInsertJob,
    wsUpdateJob,
    wsRemoveJob,
    getJob,
    cancelJob,
    removeJob,
    clearJobs,
    getResources
} from "./actions";

describe("Jobs Action Creators:", () => {
    let data;
    let jobId;
    let result;
    let expected;

    it("wsInsertJob: returns action for job insert via websocket", () => {
        data = {};
        result = wsInsertJob(data);
        expected = {
            type: WS_INSERT_JOB,
            data
        };
        expect(result).toEqual(expected);
    });

    it("wsUpdateJob: returns action for job update via websocket", () => {
        data = {};
        result = wsUpdateJob(data);
        expected = {
            type: WS_UPDATE_JOB,
            data
        };
        expect(result).toEqual(expected);
    });

    it("wsRemoveJob: returns action for job removal via websocket", () => {
        data = ["tester"];
        result = wsRemoveJob(data);
        expected = {
            type: WS_REMOVE_JOB,
            data
        };
        expect(result).toEqual(expected);
    });

    it("listJobs: returns action to retrieve specific page of job documents", () => {
        const page = 1;
        result = listJobs(page);
        expected = {
            type: LIST_JOBS.REQUESTED,
            page
        };
        expect(result).toEqual(expected);
    });

    it("filterJobs: returns action for filtering search results", () => {
        const term = "search";
        result = filterJobs(term);
        expected = {
            type: FILTER_JOBS.REQUESTED,
            term
        };
        expect(result).toEqual(expected);
    });

    it("getJob: returns action for getting a specific job", () => {
        jobId = "tester";
        result = getJob(jobId);
        expected = {
            type: GET_JOB.REQUESTED,
            jobId
        };
        expect(result).toEqual(expected);
    });

    it("cancelJob: returns action for cancelling running job", () => {
        jobId = "tester";
        result = cancelJob(jobId);
        expected = {
            type: CANCEL_JOB.REQUESTED,
            jobId
        };
        expect(result).toEqual(expected);
    });

    it("removeJob: returns action for removing a specific job", () => {
        jobId = "tester";
        result = removeJob(jobId);
        expected = {
            type: REMOVE_JOB.REQUESTED,
            jobId
        };
        expect(result).toEqual(expected);
    });

    it("clearJobs: returns action to clear a subset of jobs", () => {
        const scope = "filter";
        result = clearJobs(scope);
        expected = {
            type: CLEAR_JOBS.REQUESTED,
            scope
        };
        expect(result).toEqual(expected);
    });

    it("getResources: returns action to retrieve computing resources data", () => {
        result = getResources();
        expected = {
            type: GET_RESOURCES.REQUESTED
        };
        expect(result).toEqual(expected);
    });
});
