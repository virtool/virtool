import { pull, reject, some } from "lodash-es";

export const dataTypes = ["barcode", "genome"];

export const removeMember = (list, pendingRemoves) => {
    const target = pendingRemoves[0];
    pull(pendingRemoves, target);

    return reject(list, ["id", target]);
};
