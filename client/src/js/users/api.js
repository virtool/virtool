import Request from "superagent";

export const find = ({ term, page }) => Request.get("/api/users").query({ find: term, page });

export const get = ({ userId }) => Request.get(`/api/users/${userId}`);

export const create = ({ userId, password, forceReset }) =>
    Request.post("/api/users").send({
        user_id: userId,
        password,
        force_reset: forceReset
    });

export const edit = ({ userId, update }) => Request.patch(`/api/users/${userId}`).send(update);

export const remove = ({ userId }) => Request.delete(`/api/users/${userId}`);
