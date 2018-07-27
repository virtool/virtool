import Request from "superagent";

export const filter = ({ term }) => (
    Request.get(`/api/hmms?find=${term}`)
);

export const list = ({ page }) => (
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
