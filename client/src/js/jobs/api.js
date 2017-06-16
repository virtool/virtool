/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import Request from "superagent";

const jobsAPI = {

    find: () => {
        return Request.get("/api/jobs");
    },

    get: (jobId) => {
        return Request.get(`/api/jobs/${jobId}`);
    },

    cancel: (jobId) => {
        return Request.post(`/api/jobs/${jobId}/cancel`);
    },

    remove: (jobId) => {
        return Request.delete(`/api/jobs/${jobId}`);
    },

    test: (options = {}) => {
        return Request.post("/api/jobs/test")
            .send(options);
    },

    getResources: () => {
        return Request.get(`/api/resources`);
    },

    getCUDA: () => {
        return Request.get("/api/resources/cuda");
    }

};

export default jobsAPI;
