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

export const clear = ({ scope }) => {
    let suffix;

    if (scope === "complete") {
        suffix = "/complete";
    } else if (scope === "failed")
        suffix = "/failed";
    else {
        suffix = "";
    }

    return Request.delete(`/api/jobs${suffix}`);
};

export const getResources = () => (
    Request.get("/api/resources")
);
