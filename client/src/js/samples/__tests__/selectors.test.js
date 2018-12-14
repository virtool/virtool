import { getCanModify } from "../selectors";

describe("Samples selector helper module", () => {
    describe("getCanModify", () => {
        let state;

        beforeEach(() => {
            state = {
                account: {
                    id: "fred",
                    administrator: false,
                    groups: ["foo"]
                },
                samples: {
                    detail: {
                        all_write: false,
                        group_write: false,
                        group: "bar",
                        user: {
                            id: "bob"
                        }
                    }
                }
            };
        });

        it("should return [false] by default", () => {
            expect(getCanModify(state)).toBe(false);
        });

        it("should return [false] when user is group member but [group_write=false]", () => {
            state.account.groups.push("bar");
            expect(getCanModify(state)).toBe(false);
        });

        it("should return [false] when [group_write=true] but user is not group member", () => {
            state.samples.detail.group_write = true;
            expect(getCanModify(state)).toBe(false);
        });

        it("should return [true] when user is group member and [group_write=true]", () => {
            state.account.groups.push("bar");
            state.samples.detail.group_write = true;
            expect(getCanModify(state)).toBe(true);
        });

        it("should return [true] when [all_write=true]", () => {
            state.samples.detail.all_write = true;
            expect(getCanModify(state)).toBe(true);
        });

        it("should return [true] when user is owner", () => {
            state.samples.detail.user.id = "fred";
            expect(getCanModify(state)).toBe(true);
        });

        it("should return [true] when user is administrator", () => {
            state.account = {
                id: "fred",
                administrator: true,
                groups: []
            };
            expect(getCanModify(state)).toBe(true);
        });
    });
});
