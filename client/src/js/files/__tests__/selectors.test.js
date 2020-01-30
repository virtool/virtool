import { filesSelector } from "../selectors";

describe("Test Files Selectors", () => {
    let state;

    beforeEach(() => {
        state = {
            files: {
                documents: [
                    { id: "foo", ready: true, reserved: false },
                    { id: "fud", ready: true, reserved: false }
                ]
            }
        };
    });

    it("returns all document ids when appropriate", () => {
        const result = filesSelector(state);
        expect(result).toEqual(["foo", "fud"]);
    });

    it("excludes ids unready documents", () => {
        state.files.documents[0].ready = false;
        const result = filesSelector(state);
        expect(result).toEqual(["fud"]);
    });

    it("excludes ids reserved documents", () => {
        state.files.documents[1].reserved = true;
        const result = filesSelector(state);
        expect(result).toEqual(["foo"]);
    });
});
