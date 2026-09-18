import {
	createApiKeyFn,
	deleteApiKeyFn,
	updateApiKeyFn,
} from "@server/account/functions";
import {
	blastNuvsFn,
	createAnalysisFn,
	deleteAnalysisFn,
} from "@server/analyses/functions";
import {
	clearActiveBannerFn,
	createBannerFn,
	deleteBannerFn,
	setActiveBannerFn,
	updateBannerFn,
} from "@server/banners/functions";
import {
	clearEmailApiKeyFn,
	sendTestEmailFn,
	setEmailApiKeyFn,
	updateEmailSettingsFn,
} from "@server/email/functions";
import {
	createGroupFn,
	deleteGroupFn,
	updateGroupFn,
} from "@server/groups/functions";
import { installHmmFn } from "@server/hmm/functions";
import { createIndexFn } from "@server/indexes/functions";
import {
	createLabelFn,
	deleteLabelFn,
	updateLabelFn,
} from "@server/labels/functions";
import {
	createIsolateFn,
	createOtuFn,
	createSequenceFn,
	deleteIsolateFn,
	deleteOtuFn,
	deleteSequenceFn,
	setIsolateAsDefaultFn,
	updateIsolateFn,
	updateOtuFn,
	updateSequenceFn,
} from "@server/otus/functions";
import {
	addReferenceGroupFn,
	addReferenceUserFn,
	archiveReferenceFn,
	createReferenceFn,
	removeReferenceGroupFn,
	removeReferenceUserFn,
	unarchiveReferenceFn,
	updateReferenceFn,
	updateReferenceGroupFn,
	updateReferenceUserFn,
} from "@server/references/functions";
import {
	createSampleFn,
	deleteSampleFn,
	updateSampleFn,
	updateSampleRightsFn,
} from "@server/samples/functions";
import {
	clearNcbiApiKeyFn,
	setNcbiApiKeyFn,
	updateSettingsFn,
} from "@server/settings/functions";
import {
	createSubtractionFn,
	deleteSubtractionFn,
	updateSubtractionFn,
} from "@server/subtraction/functions";
import { deleteUploadFn, initUploadFn } from "@server/uploads/functions";
import {
	changePasswordFn,
	createUserFn,
	setAdministratorRoleFn,
	updateAccountEmailFn,
	updateAccountHandleFn,
	updateUserFn,
} from "@server/users/functions";

/** Server functions explicitly classified as user-initiated activity. */
export const userActivityEndpoints: ReadonlyArray<{ url: string }> = [
	createApiKeyFn,
	deleteApiKeyFn,
	updateApiKeyFn,
	blastNuvsFn,
	createAnalysisFn,
	deleteAnalysisFn,
	clearActiveBannerFn,
	createBannerFn,
	deleteBannerFn,
	setActiveBannerFn,
	updateBannerFn,
	clearEmailApiKeyFn,
	sendTestEmailFn,
	setEmailApiKeyFn,
	updateEmailSettingsFn,
	createGroupFn,
	deleteGroupFn,
	updateGroupFn,
	installHmmFn,
	createIndexFn,
	createLabelFn,
	deleteLabelFn,
	updateLabelFn,
	createIsolateFn,
	createOtuFn,
	createSequenceFn,
	deleteIsolateFn,
	deleteOtuFn,
	deleteSequenceFn,
	setIsolateAsDefaultFn,
	updateIsolateFn,
	updateOtuFn,
	updateSequenceFn,
	addReferenceGroupFn,
	addReferenceUserFn,
	archiveReferenceFn,
	createReferenceFn,
	removeReferenceGroupFn,
	removeReferenceUserFn,
	unarchiveReferenceFn,
	updateReferenceFn,
	updateReferenceGroupFn,
	updateReferenceUserFn,
	createSampleFn,
	deleteSampleFn,
	updateSampleFn,
	updateSampleRightsFn,
	clearNcbiApiKeyFn,
	setNcbiApiKeyFn,
	updateSettingsFn,
	createSubtractionFn,
	deleteSubtractionFn,
	updateSubtractionFn,
	deleteUploadFn,
	initUploadFn,
	changePasswordFn,
	createUserFn,
	setAdministratorRoleFn,
	updateAccountEmailFn,
	updateAccountHandleFn,
	updateUserFn,
];
