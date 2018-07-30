import { createSelector } from "reselect";
import { map } from "lodash-es";

const getUsers = state => state.users.list;

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
