import { GET_SETTINGS, UPDATE_SETTINGS, GET_CONTROL_READAHEAD, TEST_PROXY } from "../actionTypes";
import { getSettings, getControlReadahead, testProxy, updateSetting, updateSettings } from "./actions";

describe("Settings Action Creators:", () => {
    let result;
    let expected;

    it("getSettings: returns simple action", () => {
        result = getSettings();
        expected = { type: GET_SETTINGS.REQUESTED };
        expect(result).toEqual(expected);
    });

    it("getControlReadahead: returns action to retrieve search suggestions", () => {
        const refId = "123abc";
        const term = "search";
        result = getControlReadahead(refId, term);
        expected = {
            type: GET_CONTROL_READAHEAD.REQUESTED,
            refId,
            term
        };
        expect(result).toEqual(expected);
    });

    it("testProxy: returns simple action", () => {
        result = testProxy();
        expected = { type: TEST_PROXY.REQUESTED };
        expect(result).toEqual(expected);
    });

    it("updateSetting: returns action to update one setting via updateSettings()", () => {
        const key = "test_setting";
        const value = 1;
        result = updateSetting(key, value);
        expected = {
            type: UPDATE_SETTINGS.REQUESTED,
            update: { [key]: value }
        };
        expect(result).toEqual(expected);
    });

    it("updateSettings: returns action to update multiple settings", () => {
        const update = { foo: "bar" };
        result = updateSettings(update);
        expected = {
            type: UPDATE_SETTINGS.REQUESTED,
            update
        };
        expect(result).toEqual(expected);
    });
});
