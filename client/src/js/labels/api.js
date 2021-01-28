import { Request } from "../app/request";

export const listLabels = () => Request.get("/api/labels");

export const create = ({ name, description, color }) =>
    Request.post("/api/labels").send({
        name,
        description,
        color
    });

export const remove = ({ labelId }) => Request.delete(`/api/labels/${labelId}`);

export const update = ({ labelId, name, description, color }) =>
    Request.patch(`/api/labels/${labelId}`).send({
        name,
        description,
        color
    });
