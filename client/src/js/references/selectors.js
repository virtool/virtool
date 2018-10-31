import { get, map } from "lodash-es";
import { createSelector } from "reselect";

const getRefGroups = state => get(state, "references.detail.groups");
const getRefUsers = state => get(state, "references.detail.users");

const getUsers = state => get(state, "users.documents");

const getNonMembers =

const documents = map(noun === "users" ? state.users.documents : state.groups.documents, document =>
