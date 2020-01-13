import { find, indexOf, map, sortBy } from "lodash-es";
import { getTermSelectorFactory } from "../utils/selectors";

const getStateTerm = state => state.otus.term;

export const getTerm = getTermSelectorFactory(getStateTerm);

export const getTargetName = state => {
    if (state.references.detail.targets) {
        return state.references.detail.targets[0].name;
    }
    return null;
};

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

export const getActiveIsolate = state => {
    if (state.otus.detail.isolates.length) {
        return find(state.otus.detail.isolates, { id: state.otus.activeIsolateId });
    }
    return null;
};
