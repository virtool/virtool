import { compact, find, get, indexOf, map, reject, sortBy } from "lodash-es";
import { createSelector } from "reselect";
import { getActiveIsolate, getSchema, getTargets } from "../otus/selectors";

/**
 * A selector for getting the sequences of the active isolate.
 *
 * In addition to selecting the data, this selector sorts the sequences by their segment assignment based on the OTU
 * schema.
 *
 * @param {object} The Application Redux state
 * @returns {Object[]} All of the sequences of the active isolate
 */
export const getSequences = createSelector([getActiveIsolate, getSchema], (isolate, schema) => {
    if (isolate) {
        const sequences = isolate.sequences;
        const segmentNames = map(schema, "name");

        return sortBy(sequences, [
            entry => {
                const index = indexOf(segmentNames, entry.segment);

                if (index !== -1) {
                    return index;
                }

                return segmentNames.length;
            }
        ]);
    }

    return [];
});

/**
 * Get the ID of the active sequence.
 *
 * @param state {Object} The application state
 * @return {String} The ID of the active sequence
 */
export const getActiveSequenceId = state => get(state, "router.location.state.editSequence") || undefined;

/**
 * A selector for getting the data for the active sequence, if there is one.
 *
 * Checks the router location state for the sequence being edited, looks up its data in application state. An empty
 * object is returned in no active sequence is found.
 *
 * @param state {Object}
 * @return {Object}
 */
export const getActiveSequence = createSelector([getActiveSequenceId, getSequences], (activeSequenceId, sequences) => {
    if (activeSequenceId) {
        const sequence = find(sequences, { id: activeSequenceId });

        if (sequence) {
            return sequence;
        }
    }

    return {};
});

/**
 * Get all sequences other than the active sequence for the active isolate.
 *
 * @param {Object} The application state
 * @returns {Object[]} All inactive sequences for the active isolate
 */
export const getInactiveSequences = createSelector([getActiveSequenceId, getSequences], (activeSequenceId, sequences) =>
    reject(sequences, { id: activeSequenceId })
);

/**
 * Get all targets not referenced in inactive sequences.
 * @param {state} The application state
 * @returns {Object[]} Targets unreferenced in inactive sequences
 */
export const getUnreferencedTargets = createSelector(
    [getInactiveSequences, getTargets],
    (inactiveSequences, targets) => {
        const referencedTargetNames = map(inactiveSequences, sequence => sequence.target);
        return targets.filter(target => !referencedTargetNames.includes(target.name));
    }
);

export const getDefaultTargetName = state => get(getUnreferencedTargets(state), "0.name");

/**
 * Get all segment names for the active isolate that are not already assigned in the isolate's sequences. This does not
 * include any segment used by the active sequence.
 *
 * @param {object} The application state
 * @returns {Object[]} Unreferenced segments
 */
export const getUnreferencedSegments = createSelector(
    [getInactiveSequences, getSchema],
    (inactiveSequences, schema) => {
        const referencedSegmentNames = compact(map(inactiveSequences, "segment"));
        return schema.filter(segment => !referencedSegmentNames.includes(segment.name));
    }
);
