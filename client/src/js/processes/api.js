import Request from "superagent";

export const list = () => Request.get("/api/processes");

export const get = ({ processId }) => Request.get(`/api/processes/${processId}`);
