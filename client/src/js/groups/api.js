import { Request } from "../app/request";

export const list = () => Request.get("/api/groups");

export const create = ({ groupId }) => Request.post("/api/groups").send({ group_id: groupId });

export const setPermission = ({ groupId, permission, value }) =>
    Request.patch(`/api/groups/${groupId}`).send({
        permissions: {
            [permission]: value
        }
    });

export const remove = ({ groupId }) => Request.delete(`/api/groups/${groupId}`);
