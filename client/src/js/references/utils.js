import { pull, reject, some } from "lodash-es";

export const checkHasOfficialRemote = state =>
    some(state.documents, ["remotes_from.slug", "virtool/ref-plant-viruses"]);

export const removeMember = (list, pendingRemoves) => {
    const target = pendingRemoves[0];
    pull(pendingRemoves, target);

    return reject(list, ["id", target]);
};
