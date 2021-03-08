import { LIST_LABELS, CREATE_LABEL, REMOVE_LABEL, UPDATE_LABEL } from "../app/actionTypes";

/**
 * Returns action that can trigger an API call to get sample labels.
 *
 * @func
 * @returns {object}
 */
export const listLabels = () => ({
    type: LIST_LABELS.REQUESTED
});

/**
 * Returns action that can trigger an API call for removing a label.
 *
 * @func
 * @param labelId {string} unique label id
 * @returns {object}
 */
export const removeLabel = labelId => ({
    type: REMOVE_LABEL.REQUESTED,
    labelId
});

/**
 * Returns action that can trigger an API call for creating a new label.
 *
 * @func
 * @param name {string} name for label
 * @param description {string} description of label
 * @param color  {string} color name or hex value of label
 * @return {object}
 */
export const createLabel = (name, description, color) => ({
    type: CREATE_LABEL.REQUESTED,
    name,
    description,
    color
});

/**
 * Returns action that can trigger an API call for updating a label
 *
 * @func
 * @param labelId
 * @param name
 * @param description
 * @param color
 * @return {object}
 */
export const updateLabel = (labelId, name, description, color) => ({
    type: UPDATE_LABEL.REQUESTED,
    labelId,
    name,
    description,
    color
});
