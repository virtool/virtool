import { checkReferenceRight, getCanModifyReferenceOTU } from "../selectors";

const rights = ["build", "modify", "modify_otu", "remove"];

describe("checkReferenceRight()", () => {
    let state;

    beforeEach(() => {
        state = {
            account: {
                administrator: false,
                groups: ["leads"],
                id: "bob"
            },
            references: {
                detail: {
                    users: [{ id: "fred", build: false, modify: false, modify_otu: false, remove: false }],
                    groups: [{ id: "techs", build: false, modify: false, modify_otu: false, remove: false }]
                }
            }
        };
    });

    it("should return true when account is administrator", () => {
        state.account.administrator = true;
        rights.forEach(rightToCheck => {
            expect(checkReferenceRight(state, rightToCheck)).toBe(true);
        });
    });

    it.each(rights)("should return false when account does not have %p right", right => {
        state.references.detail.users.push({
            id: "bob",
            build: true,
            modify: true,
            modify_otu: true,
            remove: true,
            [right]: false
        });

        rights.forEach(rightToCheck => {
            expect(checkReferenceRight(state, rightToCheck)).toBe(right !== rightToCheck);
        });
    });

    it.each(rights)("should return true when account has %p right", right => {
        state.references.detail.users.push({
            id: "bob",
            build: false,
            modify: false,
            modify_otu: false,
            remove: false,
            [right]: true
        });

        rights.forEach(rightToCheck => {
            expect(checkReferenceRight(state, rightToCheck)).toBe(right === rightToCheck);
        });
    });

    it.each(rights)("should return true when group has %p right", right => {
        state.references.detail.groups.push({
            id: "leads",
            build: false,
            modify: false,
            modify_otu: false,
            remove: false,
            [right]: true
        });

        rights.forEach(rightToCheck => {
            expect(checkReferenceRight(state, rightToCheck)).toBe(right === rightToCheck);
        });
    });
});

describe("getCanModifyReferenceOTU()", () => {
    let state;

    beforeEach(() => {
        state = {
            account: {
                administrator: false,
                groups: ["leads"],
                id: "bob"
            },
            references: {
                detail: {
                    users: [{ id: "fred", modify_otu: true }],
                    groups: [{ id: "techs", modify_otu: true }]
                }
            }
        };
    });

    it("should return false when reference is remote", () => {
        state.references.detail.remotes_from = {
            slug: "virtool/ref-plant-viruses"
        };
        expect(getCanModifyReferenceOTU(state)).toBe(false);
    });

    it("should return true when administrator", () => {
        state.account.administrator = true;
        expect(getCanModifyReferenceOTU(state)).toBe(true);
    });

    it("should return true when user has modify_otu right", () => {
        state.references.detail.users.push({ id: "bob", modify_otu: true });
        expect(getCanModifyReferenceOTU(state)).toBe(true);
    });

    it("should return true when group has modify_otu right", () => {
        state.references.detail.groups.push({ id: "leads", modify_otu: true });
        expect(getCanModifyReferenceOTU(state)).toBe(true);
    });

    it("should return false when user does not have modify_otu_right", () => {
        state.references.detail.users.push({ id: "bob", modify_otu: false });

        expect(getCanModifyReferenceOTU(state)).toBe(false);
    });

    it("should return false when group does not have modify_otu_right", () => {
        state.references.detail.groups.push({ id: "leads", modify_otu: false });
        expect(getCanModifyReferenceOTU(state)).toBe(false);
    });
});
