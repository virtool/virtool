import {
    getSoftwareUpdates,
    installSoftwareUpdates
} from "./actions";
import { GET_SOFTWARE_UPDATES, INSTALL_SOFTWARE_UPDATES } from "../actionTypes";

describe("Updates Action Creators:", () => {

    it("getSoftwareUpdates: returns simple action", () => {
        const result = getSoftwareUpdates();
        const expected = {
            type: GET_SOFTWARE_UPDATES.REQUESTED
        };

        expect(result).toEqual(expected);
    });

    it("install: returns simple action", () => {
        const result = installSoftwareUpdates();
        const expected = {
            type: INSTALL_SOFTWARE_UPDATES.REQUESTED
        };

        expect(result).toEqual(expected);
    });
});
