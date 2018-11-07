import { GET_SOFTWARE_UPDATES, INSTALL_SOFTWARE_UPDATES } from "../../app/actionTypes";
import { getSoftwareUpdates, installSoftwareUpdates } from "../actions";

describe("Updates Action Creators:", () => {
    it("getSoftwareUpdates: returns simple action", () => {
        expect(getSoftwareUpdates()).toEqual({
            type: GET_SOFTWARE_UPDATES.REQUESTED
        });
    });

    it("install: returns simple action", () => {
        expect(installSoftwareUpdates()).toEqual({
            type: INSTALL_SOFTWARE_UPDATES.REQUESTED
        });
    });
});
