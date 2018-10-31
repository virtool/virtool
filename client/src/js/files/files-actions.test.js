import {
    WS_INSERT_FILE,
    WS_UPDATE_FILE,
    WS_REMOVE_FILE,
    REMOVE_FILE,
    UPLOAD,
    UPLOAD_PROGRESS,
    HIDE_UPLOAD_OVERLAY
} from "../actionTypes";
import {
    wsInsertFile,
    wsUpdateFile,
    wsRemoveFile,
    upload,
    removeFile,
    uploadProgress,
    hideUploadOverlay
} from "./actions";

describe("Files Action Creators", () => {
    let data;
    let result;
    let expected;

    it("wsInsertFile: returns action with websocket file insert data", () => {
        data = {};
        result = wsInsertFile(data);
        expected = {
            type: WS_INSERT_FILE,
            data
        };
        expect(result).toEqual(expected);
    });

    it("wsUpdateFile: returns action with websocket file update data", () => {
        data = {};
        result = wsUpdateFile(data);
        expected = {
            type: WS_UPDATE_FILE,
            data
        };
        expect(result).toEqual(expected);
    });

    it("wsRemoveFile: returns action with websocket file remove data", () => {
        data = {};
        result = wsRemoveFile(data);
        expected = {
            type: WS_REMOVE_FILE,
            data
        };
        expect(result).toEqual(expected);
    });

    it("listFiles: returns action with find file documents", () => {
        const fileType = "txt";
        const page = 3;
        result = listFiles(fileType, page);
        expected = {
            type: LIST_FILES.REQUESTED,
            fileType,
            page
        };
        expect(result).toEqual(expected);
    });

    it("upload: returns action with file upload to server", () => {
        const localId = "randomstring";
        const file = {};
        const fileType = "reads";
        result = upload(localId, file, fileType);
        expected = {
            type: UPLOAD.REQUESTED,
            localId,
            file,
            fileType
        };
        expect(result).toEqual(expected);
    });

    it("removeFile: returns action with file remove", () => {
        const fileId = "testerfileid";
        result = removeFile(fileId);
        expected = {
            type: REMOVE_FILE.REQUESTED,
            fileId
        };
        expect(result).toEqual(expected);
    });

    it("uploadProgress: returns action with upload progress", () => {
        const localId = "randomstring";
        const progress = 6;
        result = uploadProgress(localId, progress);
        expected = {
            type: UPLOAD_PROGRESS,
            localId,
            progress
        };
        expect(result).toEqual(expected);
    });

    it("hideUploadOverlay: returns simple action", () => {
        result = hideUploadOverlay();
        expected = {
            type: HIDE_UPLOAD_OVERLAY
        };
        expect(result).toEqual(expected);
    });
});
