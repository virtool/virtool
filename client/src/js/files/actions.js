import { simpleActionCreator } from "../utils";
import {
    WS_UPDATE_FILE,
    WS_REMOVE_FILE,
    FIND_FILES,
    REMOVE_FILE,
    UPLOAD,
    UPLOAD_PROGRESS,
    HIDE_UPLOAD_OVERLAY
} from "../actionTypes";

export const wsUpdateFile = (data) => ({
    type: WS_UPDATE_FILE,
    data
});

export const wsRemoveFile = (data) => ({
    type: WS_REMOVE_FILE,
    data
});

export const findFiles = (fileType, page) => ({
    type: FIND_FILES.REQUESTED,
    fileType,
    page
});

export const upload = (localId, file, fileType, onProgress) => ({
    type: UPLOAD.REQUESTED,
    localId,
    file,
    fileType,
    onProgress
});

export const removeFile = (fileId) => ({
    type: REMOVE_FILE.REQUESTED,
    fileId
});

export const uploadProgress = (localId, progress) => ({
    type: UPLOAD_PROGRESS,
    localId,
    progress
});

export const hideUploadOverlay = simpleActionCreator(HIDE_UPLOAD_OVERLAY);
