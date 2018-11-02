import {
    WS_INSERT_REFERENCE,
    WS_UPDATE_REFERENCE,
    WS_REMOVE_REFERENCE,
    GET_REFERENCE,
    CREATE_REFERENCE,
    EDIT_REFERENCE,
    REMOVE_REFERENCE,
    IMPORT_REFERENCE,
    CLONE_REFERENCE,
    REMOTE_REFERENCE,
    ADD_REFERENCE_USER,
    EDIT_REFERENCE_USER,
    REMOVE_REFERENCE_USER,
    ADD_REFERENCE_GROUP,
    EDIT_REFERENCE_GROUP,
    REMOVE_REFERENCE_GROUP,
    CHECK_REMOTE_UPDATES,
    UPDATE_REMOTE_REFERENCE,
    FIND_REFERENCES
} from "../../app/actionTypes";
import {
    wsInsertReference,
    wsUpdateReference,
    wsRemoveReference,
    getReference,
    createReference,
    editReference,
    importReference,
    cloneReference,
    remoteReference,
    removeReference,
    addReferenceUser,
    editReferenceUser,
    removeReferenceUser,
    addReferenceGroup,
    editReferenceGroup,
    removeReferenceGroup,
    checkUpdates,
    updateRemoteReference,
    findReferences
} from "../actions";

describe("References Action Creators:", () => {
    it("wsInsertReference", () => {
        const data = { id: "test" };
        const result = wsInsertReference(data);
        expect(result).toEqual({
            type: WS_INSERT_REFERENCE,
            data
        });
    });

    it("wsUpdateReference", () => {
        const data = { id: "test" };
        const result = wsUpdateReference(data);
        expect(result).toEqual({
            type: WS_UPDATE_REFERENCE,
            data
        });
    });

    it("wsRemoveReference", () => {
        const data = { id: "test" };
        const result = wsRemoveReference(data);
        expect(result).toEqual({
            type: WS_REMOVE_REFERENCE,
            data
        });
    });

    it("findReferences", () => {
        const term = "foo";
        const page = 5;
        const result = findReferences(term, page);
        expect(result).toEqual({
            type: FIND_REFERENCES.REQUESTED,
            term,
            page
        });
    });

    it("createReference", () => {
        const name = "create";
        const description = "blank reference";
        const dataType = "genome";
        const organism = "virus";
        const result = createReference(name, description, dataType, organism);
        expect(result).toEqual({
            type: CREATE_REFERENCE.REQUESTED,
            name,
            description,
            dataType,
            organism
        });
    });

    it("editReference", () => {
        const refId = "123abc";
        const update = { foo: "bar" };
        const result = editReference(refId, update);
        expect(result).toEqual({
            type: EDIT_REFERENCE.REQUESTED,
            refId,
            update
        });
    });

    it("importReference", () => {
        const name = "import";
        const description = "import reference";
        const dataType = "genome";
        const organism = "virus";
        const fileId = "test-file.txt";
        const result = importReference(name, description, dataType, organism, fileId);
        expect(result).toEqual({
            type: IMPORT_REFERENCE.REQUESTED,
            name,
            description,
            dataType,
            organism,
            fileId
        });
    });

    it("cloneReference", () => {
        const name = "clone";
        const description = "clone reference";
        const dataType = "genome";
        const organism = "virus";
        const refId = "123abc";
        const result = cloneReference(name, description, dataType, organism, refId);
        expect(result).toEqual({
            type: CLONE_REFERENCE.REQUESTED,
            name,
            description,
            dataType,
            organism,
            refId
        });
    });

    it("remoteReference", () => {
        expect(remoteReference()).toEqual({ type: REMOTE_REFERENCE.REQUESTED });
    });

    it("removeReference", () => {
        const refId = "123abc";
        const result = removeReference(refId);
        expect(result).toEqual({
            type: REMOVE_REFERENCE.REQUESTED,
            refId
        });
    });

    it("addReferenceUser", () => {
        const refId = "123abc";
        const user = "test-user";
        const result = addReferenceUser(refId, user);
        expect(result).toEqual({
            type: ADD_REFERENCE_USER.REQUESTED,
            refId,
            user
        });
    });

    it("editReferenceUser", () => {
        const refId = "123abc";
        const userId = "test-user";
        const update = { modify: true };
        const result = editReferenceUser(refId, userId, update);
        expect(result).toEqual({
            type: EDIT_REFERENCE_USER.REQUESTED,
            refId,
            userId,
            update
        });
    });

    it("removeReferenceUser", () => {
        const refId = "123abc";
        const userId = "test-user";
        const result = removeReferenceUser(refId, userId);
        expect(result).toEqual({
            type: REMOVE_REFERENCE_USER.REQUESTED,
            refId,
            userId
        });
    });

    it("addReferenceGroup", () => {
        const refId = "123abc";
        const group = "test-group";
        const result = addReferenceGroup(refId, group);
        expect(result).toEqual({
            type: ADD_REFERENCE_GROUP.REQUESTED,
            refId,
            group
        });
    });

    it("editReferenceGroup", () => {
        const refId = "123abc";
        const groupId = "test-group";
        const update = { modify: true };
        const result = editReferenceGroup(refId, groupId, update);
        expect(result).toEqual({
            type: EDIT_REFERENCE_GROUP.REQUESTED,
            refId,
            groupId,
            update
        });
    });

    it("removeReferenceGroup", () => {
        const refId = "123abc";
        const groupId = "test-group";
        const result = removeReferenceGroup(refId, groupId);
        expect(result).toEqual({
            type: REMOVE_REFERENCE_GROUP.REQUESTED,
            refId,
            groupId
        });
    });

    it("checkUpdates", () => {
        const refId = "123abc";
        const result = checkUpdates(refId);
        expect(result).toEqual({
            type: CHECK_REMOTE_UPDATES.REQUESTED,
            refId
        });
    });

    it("updateRemoteReference", () => {
        const refId = "123abc";
        const result = updateRemoteReference(refId);
        expect(result).toEqual({
            type: UPDATE_REMOTE_REFERENCE.REQUESTED,
            refId
        });
    });
});
