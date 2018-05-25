import Request from "superagent";

export const find = () => (
    Request.get(`/api/hmms${window.location.search}`)
);

export const install = () => (
    Request.post("/api/status/hmm")
);

export const get = ({ hmmId }) => (
    Request.get(`/api/hmms/${hmmId}`)
);
