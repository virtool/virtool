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
    }

};

export default jobsAPI;
