import { Request } from "../app/request";

export const list = () => Request.get("/api/tasks");

export const get = ({ taskId }) => Request.get(`/api/tasks/${taskId}`);
