import Request from "superagent";

const jobsAPI = {

    find: () => (
        Request.get(`/api/jobs${window.location.search}`)
    ),

    get: ({ jobId }) => (
        Request.get(`/api/jobs/${jobId}`)
    ),

    cancel: ({ jobId }) => (
        Request.post(`/api/jobs/${jobId}/cancel`)
    ),

    remove: ({ jobId }) => (
        Request.delete(`/api/jobs/${jobId}`)
    ),

    clear: ({ scope }) => {
        let suffix;

        if (scope === "complete") {
            suffix = "/complete";
        } else if (scope === "failed")
            suffix = "/failed";
        else {
            suffix = "";
        }

        return Request.delete(`/api/jobs${suffix}`);
    },

    getResources: () => (
        Request.get("/api/resources")
    )

};

export default jobsAPI;
