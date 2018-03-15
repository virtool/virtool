import { simpleActionCreator } from "../utils";
import {
    GET_SETTINGS,
    UPDATE_SETTINGS,
    GET_CONTROL_READAHEAD,
    TEST_PROXY
} from "../actionTypes";

export const getSettings = simpleActionCreator(GET_SETTINGS.REQUESTED);

export const getControlReadahead = (term) => ({
    type: GET_CONTROL_READAHEAD.REQUESTED,
    term
});

export const testProxy = simpleActionCreator(TEST_PROXY.REQUESTED);

export const updateSetting = (key, value) => {
    const update = {};
    update[key] = value;
    return updateSettings(update);
};

export const updateSettings = (update) => ({
    type: UPDATE_SETTINGS.REQUESTED,
    update
});
