import { Request } from "../app/request";

export const find = ({ term, page }) => Request.get("/api/users").query({ find: term, page });

export const get = ({ userId }) => Request.get(`/api/users/${userId}`);

export const create = ({ handle, password, forceReset }) =>
    Request.post("/api/users").send({
        handle,
        password,
        force_reset: forceReset
    });

export const createFirst = ({ handle, password }) =>
    Request.put("/api/users/first").send({
        handle,
        password
    });

export const edit = ({ userId, update }) => Request.patch(`/api/users/${userId}`).send(update);

export const remove = ({ userId }) => Request.delete(`/api/users/${userId}`);
