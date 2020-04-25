import { Request } from "../app/request";

export const find = ({ term, page }) => Request.get("/api/jobs").query({ find: term, page });

export const get = ({ jobId }) => Request.get(`/api/jobs/${jobId}`);

export const cancel = ({ jobId }) => Request.put(`/api/jobs/${jobId}/cancel`);

export const remove = ({ jobId }) => Request.delete(`/api/jobs/${jobId}`);

export const clear = ({ scope }) => Request.delete("/api/jobs").query({ filter: scope || "finished" });

export const getResources = () => Request.get("/api/resources");
