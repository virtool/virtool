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
    UPDATE_REMOTE_REFERENCE
} from "../actionTypes";
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
    updateRemoteReference
} from "./actions";

describe("References Action Creators:", () => {
    let data;
    let refId;
    let result;
    let expected;

    it("wsInsertReference: returns action of websocket insert reference entry", () => {
        data = { id: "test" };
        result = wsInsertReference(data);
        expected = {
            type: WS_INSERT_REFERENCE,
            data
        };
        expect(result).toEqual(expected);
    });

    it("wsUpdateReference: returns action of websocket update reference entry", () => {
        data = { id: "test" };
        result = wsUpdateReference(data);
        expected = {
            type: WS_UPDATE_REFERENCE,
            data
        };
        expect(result).toEqual(expected);
    });

    it("wsRemoveReference: returns action of websocket remove reference entry", () => {
        data = { id: "test" };
        result = wsRemoveReference(data);
        expected = {
            type: WS_REMOVE_REFERENCE,
            data
        };
        expect(result).toEqual(expected);
    });

    it("listReferences: returns action to retrieve page from references documents", () => {
        const page = 1;
        result = listReferences(page);
        expected = {
            type: LIST_REFERENCES.REQUESTED,
            page
        };
        expect(result).toEqual(expected);
    });

    it("filterReferences: returns action to return documents filtered by search term", () => {
        const term = "search";
        result = filterReferences(term);
        expected = {
            type: FILTER_REFERENCES.REQUESTED,
            term
        };
        expect(result).toEqual(expected);
    });

    it("getReference: returns action to retrieve specific reference detail", () => {
        refId = "123abc";
        result = getReference(refId);
        expected = {
            type: GET_REFERENCE.REQUESTED,
            refId
        };
        expect(result).toEqual(expected);
    });

    it("createReference: returns action to create a new reference entry", () => {
        const name = "create";
        const description = "blank reference";
        const dataType = "genome";
        const organism = "virus";
        result = createReference(name, description, dataType, organism);
        expected = {
            type: CREATE_REFERENCE.REQUESTED,
            name,
            description,
            dataType,
            organism
        };
        expect(result).toEqual(expected);
    });

    it("editReference: returns action to modify an existing reference entry", () => {
        refId = "123abc";
        const update = { foo: "bar" };
        result = editReference(refId, update);
        expected = {
            type: EDIT_REFERENCE.REQUESTED,
            refId,
            update
        };
        expect(result).toEqual(expected);
    });

    it("importReference: returns action to import reference data from a file", () => {
        const name = "import";
        const description = "import reference";
        const dataType = "genome";
        const organism = "virus";
        const fileId = "test-file.txt";
        result = importReference(name, description, dataType, organism, fileId);
        expected = {
            type: IMPORT_REFERENCE.REQUESTED,
            name,
            description,
            dataType,
            organism,
            fileId
        };
        expect(result).toEqual(expected);
    });

    it("cloneReference: return action to clone an existing reference", () => {
        const name = "clone";
        const description = "clone reference";
        const dataType = "genome";
        const organism = "virus";
        refId = "123abc";
        result = cloneReference(name, description, dataType, organism, refId);
        expected = {
            type: CLONE_REFERENCE.REQUESTED,
            name,
            description,
            dataType,
            organism,
            refId
        };
        expect(result).toEqual(expected);
    });

    it("remoteReference: returns action to download reference data from external source", () => {
        result = remoteReference();
        expected = { type: REMOTE_REFERENCE.REQUESTED };
        expect(result).toEqual(expected);
    });

    it("removeReference: returns action to delete specific reference", () => {
        refId = "123abc";
        result = removeReference(refId);
        expected = {
            type: REMOVE_REFERENCE.REQUESTED,
            refId
        };
        expect(result).toEqual(expected);
    });

    it("addReferenceUser: returns action to add authorized user to reference", () => {
        refId = "123abc";
        const user = "test-user";
        result = addReferenceUser(refId, user);
        expected = {
            type: ADD_REFERENCE_USER.REQUESTED,
            refId,
            user
        };
        expect(result).toEqual(expected);
    });

    it("editReferenceUser: returns action to modify reference user's permissions", () => {
        refId = "123abc";
        const userId = "test-user";
        const update = { modify: true };
        result = editReferenceUser(refId, userId, update);
        expected = {
            type: EDIT_REFERENCE_USER.REQUESTED,
            refId,
            userId,
            update
        };
        expect(result).toEqual(expected);
    });

    it("removeReferenceUser: returns action to remove user from reference", () => {
        refId = "123abc";
        const userId = "test-user";
        result = removeReferenceUser(refId, userId);
        expected = {
            type: REMOVE_REFERENCE_USER.REQUESTED,
            refId,
            userId
        };
        expect(result).toEqual(expected);
    });

    it("addReferenceGroup: returns action to add group to a reference", () => {
        refId = "123abc";
        const group = "test-group";
        result = addReferenceGroup(refId, group);
        expected = {
            type: ADD_REFERENCE_GROUP.REQUESTED,
            refId,
            group
        };
        expect(result).toEqual(expected);
    });

    it("editReferenceGroup: returns action to edit reference group permissions", () => {
        refId = "123abc";
        const groupId = "test-group";
        const update = { modify: true };
        result = editReferenceGroup(refId, groupId, update);
        expected = {
            type: EDIT_REFERENCE_GROUP.REQUESTED,
            refId,
            groupId,
            update
        };
        expect(result).toEqual(expected);
    });

    it("removeReferenceGroup: returns action to remove reference group", () => {
        refId = "123abc";
        const groupId = "test-group";
        result = removeReferenceGroup(refId, groupId);
        expected = {
            type: REMOVE_REFERENCE_GROUP.REQUESTED,
            refId,
            groupId
        };
        expect(result).toEqual(expected);
    });

    it("checkUpdates: returns action to retrieve latest remote reference metadata", () => {
        refId = "123abc";
        result = checkUpdates(refId);
        expected = {
            type: CHECK_REMOTE_UPDATES.REQUESTED,
            refId
        };
        expect(result).toEqual(expected);
    });

    it("updateRemoteReference: returns action to import latest remote reference data", () => {
        refId = "123abc";
        result = updateRemoteReference(refId);
        expected = {
            type: UPDATE_REMOTE_REFERENCE.REQUESTED,
            refId
        };
        expect(result).toEqual(expected);
    });
});
