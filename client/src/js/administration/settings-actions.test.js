import {
    getSettings,
    testProxy,
    updateSetting,
    updateSettings
} from "./actions";
import {
    GET_SETTINGS,
    UPDATE_SETTINGS,
    TEST_PROXY
} from "../actionTypes";

describe("Settings Action Creators:", () => {

    it("getSettings: returns simple action", () => {
        const result = getSettings();
        const expected = {
            type: GET_SETTINGS.REQUESTED
        };

        expect(result).toEqual(expected);
    });

    it("testProxy: returns simple action", () => {
        const result = testProxy();
        const expected = {
            type: TEST_PROXY.REQUESTED
        };

        expect(result).toEqual(expected);
    });

    it("updateSetting: returns action to update one setting via updateSettings()", () => {
        const key = "test_setting";
        const value = 1;
        const result = updateSetting(key, value);
        const expected = {
            type: UPDATE_SETTINGS.REQUESTED,
            update: {
                [key]: value
            }
        };

        expect(result).toEqual(expected);
    });

    it("updateSettings: returns action to update multiple settings", () => {
        const update = {};
        const result = updateSettings(update);
        const expected = {
            type: UPDATE_SETTINGS.REQUESTED,
            update
        };

        expect(result).toEqual(expected);
    });

});
