import { createSelector } from "reselect";
import { map } from "lodash-es";

const getUsers = state => state.users.list;
const getFiles = state => state.files.documents;

const mapIds = (list) => (map(list, entry => entry.id));

export const usersSelector = createSelector(
    [ getUsers ],
    (list) => {

        if (list === null) {
            return { documents: null, page: 0, page_count: 0 };
        }

        return {
            documents: map(list.documents, entry => entry.id),
            page: list.page,
            page_count: list.page_count
        };

    }
);

export const filesSelector = createSelector([ getFiles ], mapIds);
