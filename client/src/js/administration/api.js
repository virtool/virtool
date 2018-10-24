import Request from "superagent";

export const get = () => Request.get("/api/settings");

export const update = ({ update }) =>
  Request.patch("/api/settings").send(update);

export const proxy = () => Request.get("/api/settings/proxy");
