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

    find: (term, page) => {
        return Request.get("/api/jobs")
            .query({
                find: term || undefined,
                page
            });
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

    clear: (scope) => {
        let url = "/api/jobs";

        if (scope === "complete") {
            url = "/api/jobs/complete";
        }

        if (scope === "failed") {
            url = "/api/jobs/failed";
        }

        return Request.delete(url)
    },

    getResources: () => {
        return Request.get("/api/resources");
    }

};

export default jobsAPI;
