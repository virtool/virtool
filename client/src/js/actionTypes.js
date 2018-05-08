/**
 * @module actionTypes
 */

/**
 * Create a special action type used for requests.
 *
 * The request is an object with three properties assigned with action types used for API requests.
 *
 * - REQUESTED
 * - SUCCEEDED
 * - FAILED
 *
 * @param root {string} the root name of the action type
 * @returns {object} a request-style action type
 */
const createRequestActionType = (root) => ({
    REQUESTED: `${root}_REQUESTED`,
    SUCCEEDED: `${root}_SUCCEEDED`,
    FAILED: `${root}_FAILED`
});

export const SET_APP_PENDING = "SET_APP_PENDING";
export const UNSET_APP_PENDING = "UNSET_APP_PENDING";
export const WS_CLOSED = "WS_CLOSED";

// Errors
export const CLEAR_ERROR = "CLEAR_ERROR";

// Jobs
export const WS_UPDATE_JOB = "WS_UPDATE_JOB";
export const WS_REMOVE_JOB = "WS_REMOVE_JOB";
export const FIND_JOBS = createRequestActionType("FIND_JOBS");
export const GET_JOB = createRequestActionType("GET_JOB");
export const CANCEL_JOB = createRequestActionType("CANCEL_JOB");
export const REMOVE_JOB = createRequestActionType("REMOVE_JOB");
export const CLEAR_JOBS = createRequestActionType("CLEAR_JOBS");
export const GET_RESOURCES = createRequestActionType("GET_RESOURCES");

// Samples
export const WS_UPDATE_SAMPLE = "WS_UPDATE_SAMPLE";
export const WS_REMOVE_SAMPLE = "WS_REMOVE_SAMPLE";
export const WS_UPDATE_ANALYSIS = "WS_UPDATE_ANALYSIS";
export const WS_REMOVE_ANALYSIS = "WS_REMOVE_ANALYSIS";
export const FIND_SAMPLES = createRequestActionType("FIND_SAMPLES");
export const FIND_READY_HOSTS = createRequestActionType("FIND_READY_HOSTS");
export const GET_SAMPLE = createRequestActionType("GET_SAMPLE");
export const REFRESH_SAMPLE = createRequestActionType("REFRESH_SAMPLE");
export const CREATE_SAMPLE = createRequestActionType("CREATE_SAMPLE");
export const UPDATE_SAMPLE = createRequestActionType("UPDATE_SAMPLE");
export const UPDATE_SAMPLE_GROUP = createRequestActionType("UPDATE_SAMPLE_GROUP");
export const UPDATE_SAMPLE_RIGHTS = createRequestActionType("UPDATE_SAMPLE_RIGHTS");
export const REMOVE_SAMPLE = createRequestActionType("REMOVE_SAMPLE");
export const FIND_ANALYSES = createRequestActionType("FIND_ANALYSES");
export const GET_ANALYSIS = createRequestActionType("GET_ANALYSIS");
export const GET_ANALYSIS_PROGRESS = "GET_ANALYSIS_PROGRESS";
export const ANALYZE = createRequestActionType("ANALYZE");
export const BLAST_NUVS = createRequestActionType("BLAST_NUVS");
export const REMOVE_ANALYSIS = createRequestActionType("REMOVE_ANALYSIS");
export const SHOW_REMOVE_SAMPLE = "SHOW_REMOVE_SAMPLE";
export const HIDE_SAMPLE_MODAL = "HIDE_SAMPLE_MODAL";

// Refs
export const LIST_REFERENCES = createRequestActionType("LIST_REFERENCES");
export const GET_REFERENCE = createRequestActionType("GET_REFERENCE");
export const CREATE_REFERENCE = createRequestActionType("CREATE_REFERENCE");
export const REMOVE_REFERENCE = createRequestActionType("REMOVE_REFERENCE");

// Processes
export const WS_UPDATE_PROCESS = "WS_UPDATE_PROCESS";
export const LIST_PROCESSES = createRequestActionType("LIST_PROCESSES");
export const GET_PROCESS = createRequestActionType("GET_PROCESS");

// OTU
export const WS_UPDATE_OTU = "WS_UPDATE_OTU";
export const WS_REMOVE_OTU = "WS_REMOVE_OTU";
export const FETCH_OTUS = "FETCH_OTUS";
export const FIND_OTUS = createRequestActionType("FIND_OTUS");
export const GET_OTU = createRequestActionType("GET_OTU");
export const CREATE_OTU = createRequestActionType("CREATE_OTU");
export const EDIT_OTU = createRequestActionType("EDIT_OTU");
export const REMOVE_OTU = createRequestActionType("REMOVE_OTU");
export const GET_OTU_HISTORY = createRequestActionType("GET_OTU_HISTORY");
export const ADD_ISOLATE = createRequestActionType("ADD_ISOLATE");
export const EDIT_ISOLATE = createRequestActionType("EDIT_ISOLATE");
export const SET_ISOLATE_AS_DEFAULT = createRequestActionType("SET_ISOLATE_AS_DEFAULT");
export const REMOVE_ISOLATE = createRequestActionType("REMOVE_ISOLATE");
export const ADD_SEQUENCE = createRequestActionType("ADD_SEQUENCE");
export const EDIT_SEQUENCE = createRequestActionType("EDIT_SEQUENCE");
export const REMOVE_SEQUENCE = createRequestActionType("REMOVE_SEQUENCE");
export const REVERT = createRequestActionType("REVERT");
export const UPLOAD_IMPORT = createRequestActionType("UPLOAD_IMPORT");
export const COMMIT_IMPORT = createRequestActionType("COMMIT_IMPORT");
export const SELECT_ISOLATE = "SELECT_ISOLATE";
export const SELECT_SEQUENCE = "SELECT_SEQUENCE";
export const SHOW_EDIT_OTU = "SHOW_EDIT_OTU";
export const SHOW_REMOVE_OTU = "SHOW_REMOVE_OTU";
export const SHOW_ADD_ISOLATE = "SHOW_ADD_ISOLATE";
export const SHOW_EDIT_ISOLATE = "SHOW_EDIT_ISOLATE";
export const SHOW_REMOVE_ISOLATE = "SHOW_REMOVE_ISOLATE";
export const SHOW_ADD_SEQUENCE = "SHOW_ADD_SEQUENCE";
export const SHOW_EDIT_SEQUENCE = "SHOW_EDIT_SEQUENCE";
export const SHOW_REMOVE_SEQUENCE = "SHOW_REMOVE_SEQUENCE";
export const HIDE_OTU_MODAL = "HIDE_OTU_MODAL";

// HMMs
export const FETCH_HMMS = "FETCH_HMMS";
export const FIND_HMMS = createRequestActionType("FIND_HMMS");
export const GET_HMM = createRequestActionType("GET_HMM");
export const INSTALL_HMMS = createRequestActionType("INSTALL_HMMS");

// Indexes
export const WS_UPDATE_INDEX = "WS_UPDATE_INDEX";

export const FIND_INDEXES = createRequestActionType("FIND_INDEXES");
export const GET_INDEX = createRequestActionType("GET_INDEX");
export const GET_UNBUILT = createRequestActionType("GET_UNBUILT");
export const CREATE_INDEX = createRequestActionType("CREATE_INDEX");
export const GET_INDEX_HISTORY = createRequestActionType("GET_INDEX_HISTORY");

// Subtraction
export const WS_UPDATE_SUBTRACTION = "WS_UPDATE_SUBTRACTION";
export const WS_REMOVE_SUBTRACTION = "WS_REMOVE_SUBTRACTION";

export const FIND_SUBTRACTIONS = createRequestActionType("FIND_SUBTRACTIONS");
export const LIST_SUBTRACTION_IDS = createRequestActionType("LIST_SUBTRACTION_IDS");
export const GET_SUBTRACTION = createRequestActionType("GET_SUBTRACTION");
export const CREATE_SUBTRACTION = createRequestActionType("CREATE_SUBTRACTION");
export const UPDATE_SUBTRACTION = createRequestActionType("UPDATE_SUBTRACTION");
export const REMOVE_SUBTRACTION = createRequestActionType("REMOVE_SUBTRACTION");

// Files
export const WS_UPDATE_FILE = "WS_UPDATE_FILE";
export const WS_REMOVE_FILE = "WS_REMOVE_FILE";
export const FIND_FILES = createRequestActionType("FIND_FILES");
export const REMOVE_FILE = createRequestActionType("REMOVE_FILE");
export const UPLOAD = createRequestActionType("UPLOAD");
export const UPLOAD_PROGRESS = "UPLOAD_PROGRESS";
export const HIDE_UPLOAD_OVERLAY = "HIDE_UPLOAD_OVERLAY";

// Account
export const WS_UPDATE_ACCOUNT = createRequestActionType("WS_UPDATE_ACCOUNT");
export const GET_ACCOUNT = createRequestActionType("GET_ACCOUNT");
export const UPDATE_ACCOUNT = createRequestActionType("UPDATE_ACCOUNT");
export const GET_ACCOUNT_SETTINGS = createRequestActionType("GET_ACCOUNT_SETTINGS");
export const UPDATE_ACCOUNT_SETTINGS = createRequestActionType("UPDATE_ACCOUNT_SETTINGS");
export const CHANGE_ACCOUNT_PASSWORD = createRequestActionType("CHANGE_ACCOUNT_PASSWORD");
export const GET_API_KEYS = createRequestActionType("GET_API_KEYS");
export const CREATE_API_KEY = createRequestActionType("CREATE_API_KEY");
export const UPDATE_API_KEY = createRequestActionType("UPDATE_API_KEY");
export const REMOVE_API_KEY = createRequestActionType("REMOVE_API_KEY");
export const CLEAR_API_KEY = "CLEAR_API_KEY";
export const LOGOUT = createRequestActionType("LOGOUT");

// Administrative Settings
export const GET_SETTINGS = createRequestActionType("GET_SETTINGS");
export const UPDATE_SETTINGS = createRequestActionType("UPDATE_SETTINGS");
export const GET_CONTROL_READAHEAD = createRequestActionType("GET_CONTROL_READAHEAD");
export const TEST_PROXY = createRequestActionType("TEST_PROXY");

// Users
export const LIST_USERS = createRequestActionType("LIST_USERS");
export const FILTER_USERS = "FILTER_USERS";
export const CREATE_USER = createRequestActionType("CREATE_USER");
export const EDIT_USER = createRequestActionType("EDIT_USER");

// Groups
export const LIST_GROUPS = createRequestActionType("LIST_GROUPS");
export const CREATE_GROUP = createRequestActionType("CREATE_GROUP");
export const SET_GROUP_PERMISSION = createRequestActionType("SET_GROUP_PERMISSION");
export const REMOVE_GROUP = createRequestActionType("REMOVE_GROUP");

// Updates
export const WS_UPDATE_STATUS = "WS_UPDATE_STATUS";
export const GET_SOFTWARE_UPDATES = createRequestActionType("GET_SOFTWARE_UPDATES");
export const GET_DATABASE_UPDATES = createRequestActionType("GET_DATABASE_UPDATES");
export const INSTALL_SOFTWARE_UPDATES = createRequestActionType("INSTALL_SOFTWARE_UPDATES");
export const SHOW_INSTALL_MODAL = "SHOW_INSTALL_MODAL";
export const HIDE_INSTALL_MODAL = "HIDE_INSTALL_MODAL";
