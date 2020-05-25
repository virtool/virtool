import { getFilteredFileIds } from "../selectors";

describe("getFilteredFileIds()", () => {
    let state;

    beforeEach(() => {
        state = {
            files: {
                documents: [
                    { id: "foo", ready: true, reserved: false, uploaded_at: "2020-01-24T23:54:02Z" },
                    { id: "bar", ready: true, reserved: false, uploaded_at: "2020-04-24T23:54:02Z" },
                    { id: "baz", ready: true, reserved: false, uploaded_at: "2020-02-24T23:54:02Z" }
                ]
            }
        };
    });

    it("should return all document ids when appropriate", () => {
        const result = getFilteredFileIds(state);
        expect(result).toEqual(["bar", "baz", "foo"]);
    });

    it("should return only non-reserved document ids", () => {
        state.files.documents[1].reserved = true;
        const result = getFilteredFileIds(state);
        expect(result).toEqual(["baz", "foo"]);
    });
});
