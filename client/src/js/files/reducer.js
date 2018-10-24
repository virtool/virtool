/**
 * Exports a reducer for managing uploaded files.
 *
 * @module files/reducer
 */
import { every, map } from "lodash-es";
import { updateDocuments, insert, edit, remove } from "../reducerUtils";
import {
  WS_INSERT_FILE,
  WS_UPDATE_FILE,
  WS_REMOVE_FILE,
  LIST_FILES,
  UPLOAD,
  UPLOAD_PROGRESS,
  HIDE_UPLOAD_OVERLAY
} from "../actionTypes";

/**
 * The initial state to give the reducer.
 *
 * @const
 * @type {object}
 */
export const initialState = {
  documents: null,
  fileType: null,
  found_count: 0,
  page: 0,
  total_count: 0,
  fetched: false,
  refetchPage: false,
  uploads: [],
  uploadsComplete: true,
  showUploadOverlay: false
};

/**
 * If all uploads in ``state`` are complete, set the ``uploadsComplete`` property to ``true``.
 *
 * @func
 * @param state {object}
 * @returns {object}
 */
export const checkUploadsComplete = state => ({
  ...state,
  uploadsComplete: every(state.uploads, { progress: 100 })
});

/**
 * A reducer for managing uploaded files.
 *
 * @param state {object}
 * @param action {object}
 * @returns {object}
 */
export default function fileReducer(state = initialState, action) {
  switch (action.type) {
    case WS_INSERT_FILE:
      if (!state.fetched || action.data.type !== state.fileType) {
        return state;
      }
      return {
        ...state,
        documents: insert(
          state.documents,
          state.page,
          state.per_page,
          action,
          "created_at"
        ),
        total_count: state.total_count + 1
      };

    case WS_UPDATE_FILE:
      return {
        ...state,
        documents: edit(state.documents, action)
      };

    case WS_REMOVE_FILE:
      return {
        ...state,
        documents: remove(state.documents, action),
        refetchPage: state.page < state.page_count,
        total_count: state.total_count - 1
      };

    case LIST_FILES.REQUESTED:
      return {
        ...state,
        isLoading: true,
        errorLoad: false
      };

    case LIST_FILES.SUCCEEDED:
      return {
        ...state,
        ...updateDocuments(state.documents, action, state.page),
        fileType: action.fileType,
        isLoading: false,
        errorLoad: false,
        fetched: true,
        refetchPage: false
      };

    case LIST_FILES.FAILED:
      return {
        ...state,
        isLoading: false,
        errorLoad: true
      };

    case UPLOAD.REQUESTED: {
      const { name, size, type } = action.file;
      const fileType = action.fileType;
      const newState = {
        ...state,
        uploads: state.uploads.concat([
          { localId: action.localId, progress: 0, name, size, type, fileType }
        ]),
        showUploadOverlay: true
      };

      return checkUploadsComplete(newState);
    }

    case UPLOAD_PROGRESS: {
      const uploads = map(state.uploads, upload => {
        if (upload.localId !== action.localId) {
          return upload;
        }

        return { ...upload, progress: action.progress };
      });

      return checkUploadsComplete({ ...state, uploads });
    }

    case HIDE_UPLOAD_OVERLAY:
      return { ...state, showUploadOverlay: false };
  }

  return state;
}
