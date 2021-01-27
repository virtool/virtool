import {
    WS_INSERT_JOB,
    WS_UPDATE_JOB,
    WS_REMOVE_JOB,
    GET_JOB,
    CANCEL_JOB,
    REMOVE_JOB,
    CLEAR_JOBS,
    FIND_JOBS
} from "../../app/actionTypes";
import { wsInsertJob, wsUpdateJob, wsRemoveJob, getJob, cancelJob, removeJob, clearJobs, findJobs } from "../actions";

describe("Jobs Action Creators:", () => {
    it("wsInsertJob: returns action for job insert via websocket", () => {
        const data = {};
        const result = wsInsertJob(data);
        expect(result).toEqual({
            type: WS_INSERT_JOB,
            data
        });
    });

    it("wsUpdateJob: returns action for job update via websocket", () => {
        const data = {};
        const result = wsUpdateJob(data);
        expect(result).toEqual({
            type: WS_UPDATE_JOB,
            data
        });
    });

    it("wsRemoveJob: returns action for job removal via websocket", () => {
        const data = ["tester"];
        const result = wsRemoveJob(data);
        expect(result).toEqual({
            type: WS_REMOVE_JOB,
            data
        });
    });

    it("findJobs: returns action to retrieve specific page of job documents", () => {
        const term = "foo";
        const page = 2;
        const result = findJobs(term, page);
        expect(result).toEqual({
            type: FIND_JOBS.REQUESTED,
            term,
            page
        });
    });

    it("getJob: returns action for getting a specific job", () => {
        const jobId = "tester";
        const result = getJob(jobId);
        expect(result).toEqual({
            type: GET_JOB.REQUESTED,
            jobId
        });
    });

    it("cancelJob: returns action for cancelling running job", () => {
        const jobId = "tester";
        const result = cancelJob(jobId);
        expect(result).toEqual({
            type: CANCEL_JOB.REQUESTED,
            jobId
        });
    });

    it("removeJob: returns action for removing a specific job", () => {
        const jobId = "tester";
        const result = removeJob(jobId);
        expect(result).toEqual({
            type: REMOVE_JOB.REQUESTED,
            jobId
        });
    });

    it("clearJobs: returns action to clear a subset of jobs", () => {
        const scope = "filter";
        const result = clearJobs(scope);
        expect(result).toEqual({
            type: CLEAR_JOBS.REQUESTED,
            scope
        });
    });
});
