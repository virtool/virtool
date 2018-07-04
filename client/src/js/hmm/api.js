import Request from "superagent";

export const find = () => (
    Request.get(`/api/hmms${window.location.search}`)
);

export const nextPage = ({ page }) => (
    Request.get(`/api/hmms?page=${page}`)
);

export const install = () => (
    Request.post("/api/hmms/status/updates")
);

export const get = ({ hmmId }) => (
    Request.get(`/api/hmms/${hmmId}`)
);

export const purge = () => (
    Request.delete("/api/hmms")
);
