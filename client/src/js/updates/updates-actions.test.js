import {
    getSoftwareUpdates,
    installSoftwareUpdates,
    showInstallModal,
    hideInstallModal
} from "./actions";
import {
    GET_SOFTWARE_UPDATES,
    INSTALL_SOFTWARE_UPDATES,
    SHOW_INSTALL_MODAL,
    HIDE_INSTALL_MODAL
} from "../actionTypes";

describe("Updates Action Creators:", () => {

    it("getSoftwareUpdates: returns simple action", () => {
        const result = getSoftwareUpdates();
        const expected = {
            type: "GET_SOFTWARE_UPDATES_REQUESTED"
        };

        expect(result).toEqual(expected);
    });

    it("installSoftwareUpdates: returns simple action", () => {
        const result = installSoftwareUpdates();
        const expected = {
            type: "INSTALL_SOFTWARE_UPDATES_REQUESTED"
        };

        expect(result).toEqual(expected);
    });

    it("showInstallModal: returns simple action", () => {
        const result = showInstallModal();
        const expected = {
            type: "SHOW_INSTALL_MODAL"
        };

        expect(result).toEqual(expected);
    });

    it("hideInstallModal: returns simple action", () => {
        const result = hideInstallModal();
        const expected = {
            type: "HIDE_INSTALL_MODAL"
        };

        expect(result).toEqual(expected);
    });

});
