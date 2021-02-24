import { get } from "lodash-es";
import { wsInsertAnalysis, wsRemoveAnalysis, wsUpdateAnalysis } from "../analyses/actions";
import { wsInsertFile, wsRemoveFile, wsUpdateFile } from "../files/actions";
import { wsInsertGroup, wsRemoveGroup, wsUpdateGroup } from "../groups/actions";
import { wsInsertHistory, wsInsertIndex, wsUpdateIndex } from "../indexes/actions";
import { wsInsertJob, wsRemoveJob, wsUpdateJob } from "../jobs/actions";
import { wsInsertOTU, wsRemoveOTU, wsUpdateOTU } from "../otus/actions";
import { wsInsertReference, wsRemoveReference, wsUpdateReference } from "../references/actions";
import { wsInsertSample, wsRemoveSample, wsUpdateSample } from "../samples/actions";
import { wsUpdateStatus } from "../status/actions";
import { wsInsertSubtraction, wsRemoveSubtraction, wsUpdateSubtraction } from "../subtraction/actions";
import { wsInsertTask, wsUpdateTask } from "../tasks/actions";
import { wsInsertUser, wsRemoveUser, wsUpdateUser } from "../users/actions";

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
    groups: actionCreatorWrapper(wsInsertGroup),
    history: actionCreatorWrapper(wsInsertHistory),
    indexes: actionCreatorWrapper(wsInsertIndex),
    jobs: actionCreatorWrapper(wsInsertJob),
    otus: actionCreatorWrapper(wsInsertOTU),
    references: actionCreatorWrapper(wsInsertReference),
    samples: actionCreatorWrapper(wsInsertSample),
    subtraction: actionCreatorWrapper(wsInsertSubtraction),
    tasks: actionCreatorWrapper(wsInsertTask),
    uploads: actionCreatorWrapper(wsInsertFile),
    users: actionCreatorWrapper(wsInsertUser)
};

const updaters = {
    analyses: (state, message) => {
        const sampleId = get(state, "samples.detail.id");

        if (sampleId && sampleId === message.data.sample.id) {
            return wsUpdateAnalysis(message.data);
        }
    },
    groups: actionCreatorWrapper(wsUpdateGroup),
    indexes: actionCreatorWrapper(wsUpdateIndex),
    jobs: actionCreatorWrapper(wsUpdateJob),
    otus: actionCreatorWrapper(wsUpdateOTU),
    references: actionCreatorWrapper(wsUpdateReference),
    samples: actionCreatorWrapper(wsUpdateSample),
    status: actionCreatorWrapper(wsUpdateStatus),
    subtraction: actionCreatorWrapper(wsUpdateSubtraction),
    tasks: actionCreatorWrapper(wsUpdateTask),
    uploads: actionCreatorWrapper(wsUpdateFile),
    users: actionCreatorWrapper(wsUpdateUser)
};

const removers = {
    analyses: actionCreatorWrapper(wsRemoveAnalysis),
    groups: actionCreatorWrapper(wsRemoveGroup),
    jobs: actionCreatorWrapper(wsRemoveJob),
    otus: actionCreatorWrapper(wsRemoveOTU),
    references: actionCreatorWrapper(wsRemoveReference),
    samples: actionCreatorWrapper(wsRemoveSample),
    subtraction: actionCreatorWrapper(wsRemoveSubtraction),
    uploads: actionCreatorWrapper(wsRemoveFile),
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
        // Reserved word 'interface'; don't use spread syntax.
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

    this.interval = 500;

    this.establishConnection = () => {
        const protocol = window.location.protocol === "https:" ? "wss" : "ws";

        this.connection = new window.WebSocket(`${protocol}://${window.location.host}/ws`);

        this.connection.onopen = () => {
            this.interval = 500;
        };

        this.connection.onmessage = e => {
            this.handle(JSON.parse(e.data));
        };

        this.connection.onclose = () => {
            if (this.interval > 15000) {
                this.interval += 500;
            }

            setTimeout(() => {
                this.establishConnection();
            }, this.interval);
        };
    };
}
