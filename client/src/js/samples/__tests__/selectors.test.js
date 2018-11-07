import { getCanModify } from "../selectors";

describe("Samples selector helper module", () => {
    let state;
    let result;

    it("getCanModify: returns boolean value denoting whether user has sample modification rights", () => {
        state = {
            account: {
                administrator: false,
                groups: []
            },
            samples: {
                detail: null
            }
        };
        result = getCanModify(state);
        expect(result).toEqual(undefined);

        state = {
            account: {
                administrator: false,
                groups: []
            },
            samples: {
                detail: {
                    all_write: false,
                    group_write: true,
                    group: ""
                }
            }
        };
        result = getCanModify(state);
        expect(result).toEqual(false);

        state = {
            account: {
                administrator: true,
                groups: ["foo", "bar"]
            },
            samples: {
                detail: {
                    all_write: true,
                    group_write: true,
                    group: "foo"
                }
            }
        };
        result = getCanModify(state);
        expect(result).toEqual(true);
    });
});
