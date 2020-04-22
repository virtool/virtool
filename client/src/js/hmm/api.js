import { Request } from "../app/request";

export const find = ({ term, page }) => Request.get("/api/hmms").query({ find: term, page });

export const list = ({ page }) => Request.get("/api/hmms").query({ page });

export const install = () => Request.post("/api/hmms/status/updates");

export const get = ({ hmmId }) => Request.get(`/api/hmms/${hmmId}`);

export const purge = () => Request.delete("/api/hmms");
