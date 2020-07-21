import { every, filter, get, includes, some } from "lodash-es";
import createCachedSelector from "re-reselect";
import { createSelector } from "reselect";
import { getAccountAdministrator, getAccountId } from "../account/selectors";
import { getTermSelectorFactory } from "../utils/selectors";

export const getSampleGroups = state => state.account.groups;
export const getSampleName = state => get(state, "samples.detail.name");
export const getSampleDetail = state => state.samples.detail;
export const getSampleDetailId = state => get(state, "samples.detail.id");
export const getSampleLibraryType = state => get(state, "samples.detail.library_type");
export const getSampleDocuments = state => state.samples.documents;
export const getSelectedSampleIds = state => state.samples.selected;

export const getCanModify = createSelector(
    [getAccountAdministrator, getSampleGroups, getSampleDetail, getAccountId],
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
    [getAccountAdministrator, getAccountId, getSampleDetail],
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

export const getTerm = getTermSelectorFactory(state => state.samples.term);

export const getIsSelected = createCachedSelector(
    [getSelectedSampleIds, (state, sampleId) => sampleId],
    (selectedSampleIds, sampleId) => includes(selectedSampleIds, sampleId)
)((state, sampleId) => sampleId);

export const getSelectedSamples = createSelector([getSelectedSampleIds, getSampleDocuments], (selected, documents) =>
    filter(documents, document => includes(selected, document.id))
);

export const getFilesUndersized = state => some(state.samples.detail.files, file => file.size < 10000000);
