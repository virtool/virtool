import { find, get } from "lodash-es";
import { createSelector } from "reselect";
import { getTermSelectorFactory } from "../utils/selectors";

const getStateTerm = state => state.otus.term;

export const getTerm = getTermSelectorFactory(getStateTerm);

export const getSchema = state => get(state, "otus.detail.schema");

export const getTargets = state => get(state, "references.detail.targets");

export const getOTUDetailId = state => get(state, "otus.detail.id");

export const getActiveIsolateId = state => get(state, "otus.activeIsolateId");

export const getIsolates = state => get(state, "otus.detail.isolates");

export const getActiveIsolate = createSelector([getActiveIsolateId, getIsolates], (activeIsolateId, isolates) => {
    if (isolates.length) {
        return find(isolates, { id: activeIsolateId });
    }

    return null;
});

export const getHasSchema = state => get(state, "otus.detail.schema.length") > 0;
