import {
    wsUpdateFile,
    wsRemoveFile,
    findFiles,
    upload,
    removeFile,
    uploadProgress,
    hideUploadOverlay
} from "./actions";
import {
    WS_UPDATE_FILE,
    WS_REMOVE_FILE,
    FIND_FILES,
    REMOVE_FILE,
    UPLOAD,
    UPLOAD_PROGRESS,
    HIDE_UPLOAD_OVERLAY
} from "../actionTypes";

describe("Files Action Creators", () => {

    it("wsUpdateFile: returns action with websocket file update data", () => {
        const data = {};
        const result = wsUpdateFile(data);
        const expected = {
            type: WS_UPDATE_FILE,
            data
        };

        expect(result).toEqual(expected);
    });

    it("wsRemoveFile: returns action with websocket file remove data", () => {
        const data = {};
        const result = wsRemoveFile(data);
        const expected = {
            type: WS_REMOVE_FILE,
            data
        };

        expect(result).toEqual(expected);
    });

    it("findFiles: returns action with find file documents", () => {
        const fileType = "txt";
        const page = 3;
        const result = findFiles(fileType, page);
        const expected = {
            type: FIND_FILES.REQUESTED,
            fileType,
            page
        };

        expect(result).toEqual(expected);
    });

    it("upload: returns action with file upload to server", () => {
        const localId = "randomstring";
        const file = {};
        const fileType = "reads";
        const result = upload(localId, file, fileType);
        const expected = {
            type: UPLOAD.REQUESTED,
            localId,
            file,
            fileType
        };

        expect(result).toEqual(expected);
    });

    it("removeFile: returns action with file remove", () => {
        const fileId = "testerfileid";
        const result = removeFile(fileId);
        const expected = {
            type: REMOVE_FILE.REQUESTED,
            fileId
        };

        expect(result).toEqual(expected);
    });

    it("uploadProgress: returns action with upload progress", () => {
        const localId = "randomstring";
        const progress = 6;
        const result = uploadProgress(localId, progress);
        const expected = {
            type: UPLOAD_PROGRESS,
            localId,
            progress
        };

        expect(result).toEqual(expected);
    });

    it("hideUploadOverlay: returns simple action", () => {
        const result = hideUploadOverlay();
        const expected = {
            type: HIDE_UPLOAD_OVERLAY
        };

        expect(result).toEqual(expected);
    });
});
