import Request from "superagent";


export const find = () => (
    Request.get(`/api/jobs${window.location.search}`)
);

export const get = ({ jobId }) => (
    Request.get(`/api/jobs/${jobId}`)
);

export const cancel = ({ jobId }) => (
    Request.post(`/api/jobs/${jobId}/cancel`)
);

export const remove = ({ jobId }) => (
    Request.delete(`/api/jobs/${jobId}`)
);

export const clear = ({ scope }) => (
    Request.delete("/api/jobs")
        .query({filter: scope || "finished"})
);

export const getResources = () => (
    Request.get("/api/resources")
);
