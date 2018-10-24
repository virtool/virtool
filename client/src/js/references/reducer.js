import { find, forEach, concat, get, pull, reject } from "lodash-es";
import {
  WS_INSERT_REFERENCE,
  WS_UPDATE_REFERENCE,
  WS_REMOVE_REFERENCE,
  LIST_REFERENCES,
  FILTER_REFERENCES,
  GET_REFERENCE,
  EDIT_REFERENCE,
  UPLOAD,
  CHECK_REMOTE_UPDATES,
  UPDATE_REMOTE_REFERENCE,
  ADD_REFERENCE_USER,
  EDIT_REFERENCE_USER,
  REMOVE_REFERENCE_USER,
  ADD_REFERENCE_GROUP,
  EDIT_REFERENCE_GROUP,
  REMOVE_REFERENCE_GROUP,
  WS_INSERT_OTU,
  WS_REMOVE_OTU
} from "../actionTypes";
import { updateDocuments, insert, edit, remove } from "../reducerUtils";

export const initialState = {
  history: null,
  documents: null,
  page: 0,
  total_count: 0,
  detail: null,
  filter: "",
  fetched: false,
  refetchPage: false
};

export const checkHasOfficialRemote = list => {
  const hasOfficialRemote = find(list, [
    "remotes_from",
    { slug: "virtool/ref-plant-viruses" }
  ]);

  return !!hasOfficialRemote;
};

export const checkRemoveOfficialRemote = (list, removedIds, hasOfficial) => {
  if (!hasOfficial) {
    return false;
  }

  let isRemoved = false;

  forEach(removedIds, id => {
    const target = find(list, ["id", id]);

    if (get(target, "remotes_from.slug", "") === "virtool/ref-plant-viruses") {
      isRemoved = true;
    }
  });

  return isRemoved ? !hasOfficial : hasOfficial;
};

export const removeMember = (list, pendingRemoves) => {
  const target = pendingRemoves[0];
  pull(pendingRemoves, target);

  return reject(list, ["id", target]);
};

export default function referenceReducer(state = initialState, action) {
  switch (action.type) {
    case WS_INSERT_REFERENCE:
      if (!state.fetched) {
        return state;
      }
      return {
        ...state,
        installOfficial: checkHasOfficialRemote(
          concat(state.documents, [action.data])
        ),
        documents: insert(
          state.documents,
          state.page,
          state.per_page,
          action,
          "name"
        ),
        total_count: state.total_count + 1
      };

    case WS_UPDATE_REFERENCE:
      return {
        ...state,
        documents: edit(state.documents, action)
      };

    case WS_REMOVE_REFERENCE:
      return {
        ...state,
        installOfficial: checkRemoveOfficialRemote(
          state.documents,
          action.data,
          state.installOfficial
        ),
        documents: remove(state.documents, action),
        total_count: state.total_count - 1,
        refetchPage: state.page < state.page_count
      };

    case WS_INSERT_OTU:
      if (!state.detail) {
        return state;
      }
      return {
        ...state,
        detail: { ...state.detail, otu_count: state.detail.otu_count + 1 }
      };

    case WS_REMOVE_OTU:
      if (!state.detail) {
        return state;
      }
      return {
        ...state,
        detail: { ...state.detail, otu_count: state.detail.otu_count - 1 }
      };

    case LIST_REFERENCES.REQUESTED:
      return { ...state, isLoading: true, errorLoad: false };

    case LIST_REFERENCES.SUCCEEDED: {
      return {
        ...state,
        installOfficial: checkHasOfficialRemote(action.data.documents),
        ...updateDocuments(state.documents, action, state.page),
        isLoading: false,
        errorLoad: false,
        fetched: true,
        refetchPage: false
      };
    }

    case LIST_REFERENCES.FAILED:
      return { ...state, isLoading: false, errorLoad: true };

    case GET_REFERENCE.REQUESTED:
      return { ...state, detail: null };

    case GET_REFERENCE.SUCCEEDED:
      return { ...state, detail: action.data };

    case EDIT_REFERENCE.SUCCEEDED:
      return { ...state, detail: action.data };

    case UPLOAD.SUCCEEDED:
      return { ...state, importData: { ...action.data } };

    case CHECK_REMOTE_UPDATES.REQUESTED:
      return { ...state, detail: { ...state.detail, checkPending: true } };

    case CHECK_REMOTE_UPDATES.FAILED:
      return { ...state, detail: { ...state.detail, checkPending: false } };

    case CHECK_REMOTE_UPDATES.SUCCEEDED:
      return {
        ...state,
        detail: { ...state.detail, checkPending: false, release: action.data }
      };

    case UPDATE_REMOTE_REFERENCE.SUCCEEDED:
      return { ...state, detail: { ...state.detail, release: action.data } };

    case FILTER_REFERENCES.REQUESTED:
      return { ...state, filter: action.term };

    case FILTER_REFERENCES.SUCCEEDED:
      return { ...state, ...action.data };

    case ADD_REFERENCE_USER.SUCCEEDED:
      return {
        ...state,
        detail: {
          ...state.detail,
          users: concat(state.detail.users, [action.data])
        }
      };

    case EDIT_REFERENCE_USER.SUCCEEDED:
      return {
        ...state,
        detail: { ...state.detail, users: edit(state.detail.users, action) }
      };

    case REMOVE_REFERENCE_USER.REQUESTED:
      return {
        ...state,
        detail: {
          ...state.detail,
          pendingUserRemove:
            action.refId === state.detail.id
              ? concat([], [action.userId])
              : state.detail.pendingUserRemove
        }
      };

    case REMOVE_REFERENCE_USER.SUCCEEDED:
      return {
        ...state,
        detail: {
          ...state.detail,
          users: removeMember(
            state.detail.users,
            state.detail.pendingUserRemove
          )
        }
      };

    case ADD_REFERENCE_GROUP.SUCCEEDED:
      return {
        ...state,
        detail: {
          ...state.detail,
          groups: concat(state.detail.groups, [action.data])
        }
      };

    case EDIT_REFERENCE_GROUP.SUCCEEDED:
      return {
        ...state,
        detail: { ...state.detail, groups: edit(state.detail.groups, action) }
      };

    case REMOVE_REFERENCE_GROUP.REQUESTED:
      return {
        ...state,
        detail: {
          ...state.detail,
          pendingGroupRemove:
            action.refId === state.detail.id
              ? concat([], [action.groupId])
              : state.detail.pendingGroupRemove
        }
      };

    case REMOVE_REFERENCE_GROUP.SUCCEEDED:
      return {
        ...state,
        detail: {
          ...state.detail,
          groups: removeMember(state.detail.groups, state.detail.pendingRemove)
        }
      };

    default:
      return state;
  }
}
