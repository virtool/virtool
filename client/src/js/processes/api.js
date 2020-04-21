import { Request } from "../app/request";

export const list = () => Request.get("/api/processes");

export const get = ({ processId }) => Request.get(`/api/processes/${processId}`);
