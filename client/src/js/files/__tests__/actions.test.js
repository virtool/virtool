import {
    WS_INSERT_FILE,
    WS_UPDATE_FILE,
    WS_REMOVE_FILE,
    FIND_FILES,
    REMOVE_FILE,
    UPLOAD,
    UPLOAD_PROGRESS
} from "../../app/actionTypes";
import { wsInsertFile, wsUpdateFile, wsRemoveFile, findFiles, upload, removeFile, uploadProgress } from "../actions";

describe("Files Action Creators", () => {
    it("wsInsertFile: returns action with websocket file insert data", () => {
        const data = {
            id: "foo"
        };

        const result = wsInsertFile(data);

        expect(result).toEqual({
            type: WS_INSERT_FILE,
            data
        });
    });

    it("wsUpdateFile: returns action with websocket file update data", () => {
        const data = {
            id: "foo"
        };

        const result = wsUpdateFile(data);

        expect(result).toEqual({
            type: WS_UPDATE_FILE,
            data
        });
    });

    it("wsRemoveFile: returns action with websocket file remove data", () => {
        const data = ["foo", "bar"];
        const result = wsRemoveFile(data);

        expect(result).toEqual({
            type: WS_REMOVE_FILE,
            data
        });
    });

    it("findFiles: returns action with find file documents", () => {
        const fileType = "reads";
        const term = "foo";
        const page = 3;
        const result = findFiles(fileType, "foo", page);
        expect(result).toEqual({
            type: FIND_FILES.REQUESTED,
            fileType,
            term,
            page
        });
    });

    it("upload: returns action with file upload to server", () => {
        const localId = "random_string";
        const file = {
            id: "foo"
        };
        const fileType = "reads";
        const result = upload(localId, file, fileType);
        expect(result).toEqual({
            type: UPLOAD.REQUESTED,
            context: {},
            localId,
            file,
            fileType
        });
    });

    it("removeFile: returns action with file remove", () => {
        const fileId = "foo";
        const result = removeFile(fileId);
        expect(result).toEqual({
            type: REMOVE_FILE.REQUESTED,
            fileId
        });
    });

    it("uploadProgress: returns action with upload progress", () => {
        const localId = "random_string";
        const progress = 6;
        const result = uploadProgress(localId, progress);
        expect(result).toEqual({
            type: UPLOAD_PROGRESS,
            localId,
            progress
        });
    });
});
