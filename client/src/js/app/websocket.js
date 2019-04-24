import { get } from "lodash-es";
import { wsInsertAnalysis, wsUpdateAnalysis, wsRemoveAnalysis } from "../analyses/actions";
import { wsInsertFile, wsUpdateFile, wsRemoveFile } from "../files/actions";
import { wsInsertGroup, wsUpdateGroup, wsRemoveGroup } from "../groups/actions";
import { wsInsertIndex, wsUpdateIndex, wsInsertHistory } from "../indexes/actions";
import { wsInsertJob, wsUpdateJob, wsRemoveJob } from "../jobs/actions";
import { wsInsertOTU, wsUpdateOTU, wsRemoveOTU } from "../otus/actions";
import { wsInsertProcess, wsUpdateProcess } from "../processes/actions";
import { wsInsertReference, wsUpdateReference, wsRemoveReference } from "../references/actions";
import { wsInsertSample, wsUpdateSample, wsRemoveSample } from "../samples/actions";
import { wsUpdateStatus } from "../status/actions";
import { wsInsertSubtraction, wsUpdateSubtraction, wsRemoveSubtraction } from "../subtraction/actions";
import { wsInsertUser, wsUpdateUser, wsRemoveUser } from "../users/actions";
import { WS_CLOSED } from "./actionTypes";

const actionCreatorWrapper = actionCreator => {
    return (state, message) => actionCreator(message.data);
};

const inserters = {
    analyses: (state, message) => {
        const sampleId = get(state, "samples.detail.id");

        if (sampleId && sampleId === message.data.sample.id) {
            return wsInsertAnalysis(message.data);
        }
    },
    files: actionCreatorWrapper(wsInsertFile),
    groups: actionCreatorWrapper(wsInsertGroup),
    history: actionCreatorWrapper(wsInsertHistory),
    indexes: actionCreatorWrapper(wsInsertIndex),
    jobs: actionCreatorWrapper(wsInsertJob),
    otus: actionCreatorWrapper(wsInsertOTU),
    processes: actionCreatorWrapper(wsInsertProcess),
    references: actionCreatorWrapper(wsInsertReference),
    samples: actionCreatorWrapper(wsInsertSample),
    subtraction: actionCreatorWrapper(wsInsertSubtraction),
    users: actionCreatorWrapper(wsInsertUser)
};

const updaters = {
    analyses: (state, message) => {
        const sampleId = get(state, "samples.detail.id");

        if (sampleId && sampleId === message.data.sample.id) {
            return wsUpdateAnalysis(message.data);
        }
    },
    files: actionCreatorWrapper(wsUpdateFile),
    groups: actionCreatorWrapper(wsUpdateGroup),
    indexes: actionCreatorWrapper(wsUpdateIndex),
    jobs: actionCreatorWrapper(wsUpdateJob),
    otus: actionCreatorWrapper(wsUpdateOTU),
    processes: actionCreatorWrapper(wsUpdateProcess),
    references: actionCreatorWrapper(wsUpdateReference),
    samples: actionCreatorWrapper(wsUpdateSample),
    status: actionCreatorWrapper(wsUpdateStatus),
    subtraction: actionCreatorWrapper(wsUpdateSubtraction),
    users: actionCreatorWrapper(wsUpdateUser)
};

const removers = {
    analyses: actionCreatorWrapper(wsRemoveAnalysis),
    files: actionCreatorWrapper(wsRemoveFile),
    groups: actionCreatorWrapper(wsRemoveGroup),
    jobs: actionCreatorWrapper(wsRemoveJob),
    otus: actionCreatorWrapper(wsRemoveOTU),
    references: actionCreatorWrapper(wsRemoveReference),
    samples: actionCreatorWrapper(wsRemoveSample),
    subtraction: actionCreatorWrapper(wsRemoveSubtraction),
    users: actionCreatorWrapper(wsRemoveUser)
};

const modifiers = {
    insert: inserters,
    update: updaters,
    delete: removers
};

export default function WSConnection({ getState, dispatch }) {
    // The Redux store's dispatch method.
    this.dispatch = dispatch;

    this.getState = getState;

    // When a websocket message is received, this method is called with the message as the sole argument. Every message
    // has a property "operation" that tells the dispatcher what to do. Illegal operation names will throw an error.
    this.handle = message => {
        const iface = message.interface;
        const operation = message.operation;

        window.console.log(`${iface}.${operation}`);

        const modifier = get(modifiers, [operation, iface]);

        if (modifier) {
            const action = modifier(getState(), message);

            if (action) {
                return dispatch(action);
            }
        }
    };

    this.establishConnection = () => {
        const protocol = window.location.protocol === "https:" ? "wss" : "ws";

        this.connection = new window.WebSocket(`${protocol}://${window.location.host}/ws`);

        this.connection.onmessage = e => {
            this.handle(JSON.parse(e.data));
        };

        this.connection.onclose = () => {
            this.dispatch({
                type: WS_CLOSED
            });
        };
    };
}
