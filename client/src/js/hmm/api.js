import Request from "superagent";

export const find = () => (
    Request.get(`/api/hmms${window.location.search}`)
);

export const install = () => (
    Request.patch("/api/hmms/install")
);

export const get = ({ hmmId }) => (
    Request.get(`/api/hmms/${hmmId}`)
);
