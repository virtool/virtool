import * as api from "./api";
import Request from "superagent";

describe("Account API: [unit test--stubbed] tests to see if api calls correct requests", () => {
    let expected;

    let stubGET;
    let stubPATCH;
    let stubPUT;
    let stubPOST;
    let stubDELETE;

    const base = "/api/account";

    beforeAll(() => {
        stubGET = sinon.stub(Request, "get");
        stubPATCH = sinon.stub(Request, "patch");
        stubPUT = sinon.stub(Request, "put");
        stubPOST = sinon.stub(Request, "post");
        stubDELETE = sinon.stub(Request, "delete");
    });

    afterAll(() => {
        stubGET.restore();
        stubPATCH.restore();
        stubPUT.restore();
        stubPOST.restore();
        stubDELETE.restore();
    });

    beforeEach(() => {
        stubGET.resetHistory();
        stubPATCH.resetHistory();
        stubPUT.resetHistory();
        stubPOST.resetHistory();
        stubDELETE.resetHistory();
    });

    it("get(): ", () => {
        api.get();

        expected = base;

        expect(stubGET.calledOnceWith(expected)).toBe(true);
    });
/*
    it("update(): ", () => {
        const updated = { update: {} };

        api.update(updated);

        expected = base;

        expect(stubGET.calledOnceWith(expected)).toBe(true);
    });
*/
    it("getSettings(): ", () => {
        api.getSettings();

        expected = `${base}/settings`;

        expect(stubGET.calledOnceWith(expected)).toBe(true);
    });
/*
    it("updateSettings(): ", () => {
        api.updateSettings({});

        expected = `${base}/settings`;

        expect(stubPATCH.calledOnceWith(expected)).toBe(true);
    });

    it("changePassword(): ", () => {
        const update = {
            oldPassword: "oldtest",
            newPassword: "newtest"
        };

        api.changePassword(update);

        expected = `${base}/password`;

        expect(stubPUT.calledOnceWith(expected)).toBe(true);
    });
*/
    it("getAPIKeys(): ", () => {
        api.getAPIKeys();

        expected = `${base}/keys`;

        expect(stubGET.calledOnceWith(expected)).toBe(true);
    });
/*
    it("createAPIKey():", () => {
        const newKey = {
            name: "testkey",
            permissions: [ "example" ]
        };

        api.createAPIKey(newKey);

        expected = `${base}/keys`;

        expect(stubPOST.calledOnceWith(expected)).toBe(true);
    });

    it("updateAPIKey(): ", () => {
        const update = {
            keyId: "test",
            permissions: [ "example" ]
        };

        api.updateAPIKey(update);

        expected = `${base}/keys/${update.keyId}`;

        expect(stubPATCH.calledOnceWith(expected)).toBe(true);
    });
*/
    it("removeAPIKey(): ", () => {
        const removed = { keyId: "test_key" };

        api.removeAPIKey(removed);

        expected = `${base}/keys/${removed.keyId}`;

        expect(stubDELETE.calledOnceWith(expected)).toBe(true);
    });

    it("logout(): ", () => {
        api.logout();

        expected = `${base}/logout`;

        expect(stubGET.calledOnceWith(expected)).toBe(true);
    });

});
