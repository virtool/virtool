import { simpleActionCreator } from "../utils";
import { GET_SETTINGS, UPDATE_SETTINGS, GET_CONTROL_READAHEAD } from "../actionTypes";

export const getSettings = simpleActionCreator(GET_SETTINGS.REQUESTED);

export const updateSettings = (update) => ({
    type: UPDATE_SETTINGS.REQUESTED,
    update
});

export const updateSetting = (key, value) => {
    const update = {};
    update[key] = value;
    return updateSettings(update);
};

export const getControlReadahead = (term) => ({
    type: GET_CONTROL_READAHEAD.REQUESTED,
    term
});
