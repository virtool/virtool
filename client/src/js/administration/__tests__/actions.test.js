import { GET_SETTINGS, UPDATE_SETTINGS } from "../../app/actionTypes";
import { getSettings, updateSetting, updateSettings } from "../actions";

describe("getSettings()", () => {
    it("should return an action", () => {
        const result = getSettings();
        expect(result).toEqual({ type: GET_SETTINGS.REQUESTED });
    });
});

describe("updateSetting()", () => {
    it("should return an action to update one setting", () => {
        const result = updateSetting("foo", "bar");
        expect(result).toEqual({
            type: UPDATE_SETTINGS.REQUESTED,
            update: { foo: "bar" }
        });
    });
});

describe("updateSettings()", () => {
    it("should return an action to update multiple settings", () => {
        const update = { foo: "bar" };
        const result = updateSettings(update);
        expect(result).toEqual({
            type: UPDATE_SETTINGS.REQUESTED,
            update
        });
    });
});
