import Request from "superagent";

export const list = ({ page }) => Request.get(`/api/users?page=${page}`);

export const filter = ({ term }) => Request.get(`/api/users?find=${term}`);

export const get = ({ userId }) => Request.get(`/api/users/${userId}`);

export const create = ({ userId, password, forceReset }) =>
  Request.post("/api/users").send({
    user_id: userId,
    password,
    force_reset: forceReset
  });

export const edit = ({ userId, update }) =>
  Request.patch(`/api/users/${userId}`).send(update);

export const remove = ({ userId }) => Request.delete(`/api/users/${userId}`);
