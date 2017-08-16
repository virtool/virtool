/**
 * Created by igboyes on 03/05/17.
 */

const createRequestActionType = (root) => {
    return {
        REQUESTED: `${root}_REQUESTED`,
        SUCCEEDED: `${root}_SUCCEEDED`,
        FAILED: `${root}_FAILED`
    };
};

export const SET_APP_PENDING = "SET_APP_PENDING";
export const UNSET_APP_PENDING = "UNSET_APP_PENDING";

// Jobs
export const WS_UPDATE_JOB = "WS_UPDATE_JOB";
export const WS_REMOVE_JOB = "WS_REMOVE_JOB";
export const FIND_JOBS = createRequestActionType("FIND_JOBS");
export const GET_JOB = createRequestActionType("GET_JOB");
export const CANCEL_JOB = createRequestActionType("CANCEL_JOB");
export const REMOVE_JOB = createRequestActionType("REMOVE_JOB");
export const CLEAR_JOBS = createRequestActionType("CLEAR_JOBS");
export const TEST_JOB = createRequestActionType("TEST_JOB");
export const GET_RESOURCES = createRequestActionType("GET_RESOURCES");
export const GET_CUDA = createRequestActionType("GET_CUDA");

// Samples
export const WS_UPDATE_SAMPLE = "WS_UPDATE_SAMPLE";
export const WS_REMOVE_SAMPLE = "WS_REMOVE_SAMPLE";

export const FIND_SAMPLES = createRequestActionType("FIND_SAMPLES");
export const FIND_READY_HOSTS = createRequestActionType("FIND_READY_HOSTS");
export const GET_SAMPLE = createRequestActionType("GET_SAMPLE");
export const UPDATE_SAMPLE = createRequestActionType("UPDATE_SAMPLE");
export const REMOVE_SAMPLE = createRequestActionType("REMOVE_SAMPLE");
export const FIND_ANALYSES = createRequestActionType("FIND_ANALYSES");
export const GET_ANALYSIS = createRequestActionType("GET_ANALYSIS");
export const ANALYZE = createRequestActionType("ANALYZE");

export const SHOW_EDIT_SAMPLE = "SHOW_EDIT_SAMPLE";
export const SHOW_REMOVE_SAMPLE = "SHOW_REMOVE_SAMPLE";
export const HIDE_SAMPLE_MODAL = "HIDE_SAMPLE_MODAL";

// Virus
export const WS_UPDATE_VIRUS = "WS_UPDATE_VIRUS";
export const WS_REMOVE_VIRUS = "WS_REMOVE_VIRUS";

export const FIND_VIRUSES = createRequestActionType("FIND_VIRUSES");
export const GET_VIRUS = createRequestActionType("GET_VIRUS");
export const CREATE_VIRUS = createRequestActionType("CREATE_VIRUS");
export const EDIT_VIRUS = createRequestActionType("EDIT_VIRUS");
export const REMOVE_VIRUS = createRequestActionType("REMOVE_VIRUS");

export const GET_VIRUS_HISTORY = createRequestActionType("GET_VIRUS_HISTORY");

export const ADD_ISOLATE = createRequestActionType("ADD_ISOLATE");
export const EDIT_ISOLATE = createRequestActionType("EDIT_ISOLATE");
export const REMOVE_ISOLATE = createRequestActionType("REMOVE_ISOLATE");

export const ADD_SEQUENCE = createRequestActionType("ADD_SEQUENCE");
export const EDIT_SEQUENCE = createRequestActionType("EDIT_SEQUENCE");
export const REMOVE_SEQUENCE = createRequestActionType("REMOVE_SEQUENCE");

export const REVERT = createRequestActionType("REVERT");

export const SHOW_EDIT_VIRUS = "SHOW_EDIT_VIRUS";
export const SHOW_REMOVE_VIRUS = "SHOW_REMOVE_VIRUS";
export const SHOW_ADD_ISOLATE = "SHOW_ADD_ISOLATE";
export const SHOW_EDIT_ISOLATE = "SHOW_EDIT_ISOLATE";
export const SHOW_REMOVE_ISOLATE = "SHOW_REMOVE_ISOLATE";
export const SHOW_ADD_SEQUENCE = "SHOW_ADD_SEQUENCE";
export const SHOW_EDIT_SEQUENCE = "SHOW_EDIT_SEQUENCE";
export const SHOW_REMOVE_SEQUENCE = "SHOW_REMOVE_SEQUENCE";
export const HIDE_VIRUS_MODAL = "HIDE_VIRUS_MODAL";

// Indexes
export const WS_UPDATE_INDEX = "WS_UPDATE_INDEX";

export const FIND_INDEXES = createRequestActionType("FIND_INDEXES");
export const GET_INDEX = createRequestActionType("GET_INDEX");
export const CREATE_INDEX = createRequestActionType("CREATE_INDEX");
export const GET_INDEX_HISTORY = createRequestActionType("GET_INDEX_HISTORY");
export const CLEAR_INDEX_ERROR = "CLEAR_INDEX_ERROR";

// Subtraction
export const WS_UPDATE_SUBTRACTION = "WS_UPDATE_SUBTRACTION";
export const WS_REMOVE_SUBTRACTION = "WS_REMOVE_SUBTRACTION";

export const FIND_SUBTRACTIONS = createRequestActionType("FIND_SUBTRACTIONS");
export const GET_SUBTRACTION = createRequestActionType("GET_SUBTRACTION");
export const REMOVE_SUBTRACTION = createRequestActionType("REMOVE_SUBTRACTION");

// Files
export const WS_UPDATE_FILE = "WS_UPDATE_FILE";
export const WS_REMOVE_FILE = "WS_REMOVE_FILE";
export const FIND_FILES = createRequestActionType("FIND_FILES");
export const REMOVE_FILE = createRequestActionType("REMOVE_FILE");
export const UPLOAD_READS = createRequestActionType("UPLOAD_READS");
export const UPLOAD_PROGRESS = "UPLOAD_PROGRESS";
export const HIDE_UPLOAD_OVERLAY = "HIDE_UPLOAD_OVERLAY";

// Account
export const GET_ACCOUNT_REQUESTED = "GET_ACCOUNT_REQUESTED";
export const GET_ACCOUNT_SUCCEEDED = "GET_ACCOUNT_SUCCEEDED";
export const GET_ACCOUNT_FAILED = "GET_ACCOUNT_FAILED";
export const LOGOUT_REQUESTED = "LOGOUT_REQUESTED";
export const LOGOUT_SUCCEEDED = "LOGOUT_SUCCEEDED";

// Administrative setting actionTypes
export const GET_SETTINGS = createRequestActionType("GET_SETTINGS");
export const UPDATE_SETTINGS = createRequestActionType("UPDATE_SETTINGS");

export const SET_SOURCE_TYPE_VALUE = "SET_SOURCE_TYPE_VALUE";
export const SET_CONTROL_READAHEAD_TERM = "SET_CONTROL_READAHEAD_TERM";
export const GET_CONTROL_READAHEAD_REQUESTED = "GET_CONTROL_READAHEAD_REQUESTED";
export const GET_CONTROL_READAHEAD_SUCCEEDED = "GET_CONTROL_READAHEAD_SUCCEEDED";
export const GET_CONTROL_READAHEAD_FAILED = "GET_CONTROL_READAHEAD_FAILED";

// Users
export const LIST_USERS = createRequestActionType("LIST_USERS");
export const SELECT_USER = "SELECT_USER";
export const CHANGE_SET_PASSWORD = "CHANGE_SET_PASSWORD";
export const CHANGE_SET_CONFIRM = "CHANGE_SET_CONFIRM";
export const SET_PASSWORD = createRequestActionType("SET_PASSWORD");
export const CLEAR_SET_PASSWORD = "CLEAR_SET_PASSWORD";
export const SET_FORCE_RESET = createRequestActionType("SET_FORCE_RESET");
export const SET_PRIMARY_GROUP = createRequestActionType("SET_PRIMARY_GROUP");
export const ADD_USER_TO_GROUP = createRequestActionType("ADD_USER_TO_GROUP");
export const REMOVE_USER_FROM_GROUP = createRequestActionType("REMOVE_USER_FROM_GROUP");

// Groups
export const LIST_GROUPS = createRequestActionType("LIST_GROUPS");
