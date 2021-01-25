import { Request } from "../app/request";

export const post = ({ command }) => Request.post(`/api/dev`).send({ command });
