import { every, filter, get, includes, some } from "lodash-es";
import { createSelector } from "reselect";
import { getTermSelectorFactory } from "../utils/selectors";

const getAdministrator = state => state.account.administrator;
const getUserId = state => state.account.id;
const getGroups = state => state.account.groups;
const getSample = state => state.samples.detail;

export const getCanModify = createSelector(
    [getAdministrator, getGroups, getSample, getUserId],
    (administrator, groups, sample, userId) => {
        if (sample) {
            return (
                administrator ||
                sample.all_write ||
                sample.user.id === userId ||
                (sample.group_write && includes(groups, sample.group))
            );
        }
    }
);

export const getCanModifyRights = createSelector(
    [getAdministrator, getUserId, getSample],
    (administrator, userId, sample) => {
        if (sample === null) {
            return;
        }

        return administrator || sample.user.id === userId;
    }
);

export const getDefaultSubtraction = state =>
    get(state, "samples.detail.subtraction.id", get(state, ["subtraction", "shortlist", 0, "id"]));

export const getMaxReadLength = state => state.samples.detail.quality.length[1];

export const getSampleFiles = state => state.samples.detail.files;

export const getSampleUpdateJobId = state => get(state, "samples.detail.update_job.id");

export const getHasRawFilesOnly = createSelector([getSampleFiles], files => every(files, "raw"));

export const getIsReadyToReplace = createSelector(
    [getSampleFiles, getSampleUpdateJobId],
    (files, jobId) => every(files, "replacement.id") && !jobId
);

export const getStateTerm = state => state.samples.term;

export const getTerm = getTermSelectorFactory(getStateTerm);

export const getSampleDetail = state => state.samples.detail;

export const getSampleDetailId = state => get(state, "samples.detail.id");

export const getSampleLibraryType = state => get(state, "samples.detail.library_type");

export const getSampleDocuments = state => state.samples.documents;

export const getSelectedSampleIds = state => get(state, "router.location.state.createAnalysis", []);

export const getSelectedDocuments = createSelector(
    [getSelectedSampleIds, getSampleDetail, getSampleDocuments],
    (selected, detail, documents) => {
        if (detail && selected.length === 1 && selected[0] === detail.id) {
            return [detail];
        }

        return filter(documents, document => includes(selected, document.id));
    }
);

export const getFilesUndersized = state => some(state.samples.detail.files, file => file.size < 10000000);
