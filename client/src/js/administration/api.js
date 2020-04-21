import { Request } from "../app/request";

export const get = () => Request.get("/api/settings");

export const update = ({ update }) => Request.patch("/api/settings").send(update);
