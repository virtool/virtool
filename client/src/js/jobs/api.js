import Request from "superagent";

export const list = ({ page }) => Request.get(`/api/jobs?page=${page}`);

export const filter = ({ term }) => Request.get(`/api/jobs?term=${term}`);

export const get = ({ jobId }) => Request.get(`/api/jobs/${jobId}`);

export const cancel = ({ jobId }) => Request.put(`/api/jobs/${jobId}/cancel`);

export const remove = ({ jobId }) => Request.delete(`/api/jobs/${jobId}`);

export const clear = ({ scope }) =>
  Request.delete("/api/jobs").query({ filter: scope || "finished" });

export const getResources = () => Request.get("/api/resources");
