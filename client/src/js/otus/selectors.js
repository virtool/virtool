import { compact, difference, find, get, indexOf, map, sortBy } from "lodash-es";
import { createSelector } from "reselect";
import { getTermSelectorFactory } from "../utils/selectors";

const getStateTerm = state => state.otus.term;

export const getTerm = getTermSelectorFactory(getStateTerm);

export const getSequences = state => {
    const activeIsolate = getActiveIsolate(state);
    const sequences = activeIsolate.sequences;
    const originalSchema = map(state.otus.detail.schema, "name");
    let index;

    if (activeIsolate) {
        return sortBy(sequences, [
            entry => {
                index = indexOf(originalSchema, entry.segment);
                if (index !== -1) {
                    return index;
                }
                return originalSchema.length;
            }
        ]);
    }
    return null;
};

export const getSchema = state => get(state, "otus.detail.schema");

export const getAvailableSegmentNames = createSelector([getSchema, getSequences], (schema, sequences) => {
    const segmentNames = map(schema, "name");
    const usedSegments = compact(map(sequences, "segment"));

    return difference(segmentNames, usedSegments);
});

export const getTargets = state => state.references.detail.targets;

export const getUnreferencedTargets = createSelector([getTargets, getSequences], (targets, sequences) => {
    const referencedTargetNames = map(sequences, sequence => sequence.target);
    return targets.filter(target => !referencedTargetNames.includes(target.name));
});

export const getTargetName = createSelector([getUnreferencedTargets], targets => get(targets, "0.name"), "");

export const getOTUDetailId = state => get(state, "otus.detail.id");

export const getActiveIsolateId = state => state.otus.activeIsolateId;

export const getIsolates = state => get(state, "otus.detail.isolates");

export const getActiveIsolate = createSelector([getActiveIsolateId, getIsolates], (activeIsolateId, isolates) => {
    if (isolates.length) {
        return find(isolates, { id: activeIsolateId });
    }

    return null;
});
