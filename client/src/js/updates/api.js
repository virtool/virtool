import Request from "superagent";

export const get = () => Request.get("/api/software");

export const install = () => Request.post("/api/software/updates");
