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

const documentInserters = {
    analyses: wsInsertAnalysis,
    files: wsInsertFile,
    groups: wsInsertGroup,
    history: wsInsertHistory,
    indexes: wsInsertIndex,
    jobs: wsInsertJob,
    otus: wsInsertOTU,
    processes: wsInsertProcess,
    references: wsInsertReference,
    samples: wsInsertSample,
    subtraction: wsInsertSubtraction,
    users: wsInsertUser
};

const documentUpdaters = {
    analyses: wsUpdateAnalysis,
    files: wsUpdateFile,
    groups: wsUpdateGroup,
    indexes: wsUpdateIndex,
    jobs: wsUpdateJob,
    otus: wsUpdateOTU,
    processes: wsUpdateProcess,
    references: wsUpdateReference,
    samples: wsUpdateSample,
    status: wsUpdateStatus,
    subtraction: wsUpdateSubtraction,
    users: wsUpdateUser
};

const documentRemovers = {
    analyses: wsRemoveAnalysis,
    files: wsRemoveFile,
    groups: wsRemoveGroup,
    jobs: wsRemoveJob,
    otus: wsRemoveOTU,
    references: wsRemoveReference,
    samples: wsRemoveSample,
    subtraction: wsRemoveSubtraction,
    users: wsRemoveUser
};

export default function WSConnection(dispatch) {
    // The Redux store's dispatch method.
    this.dispatch = dispatch;

    // When a websocket message is received, this method is called with the message as the sole argument. Every message
    // has a property "operation" that tells the dispatcher what to do. Illegal operation names will throw an error.
    this.handle = message => {
        const iface = message.interface;
        const operation = message.operation;

        window.console.log(`${iface}.${operation}`);

        if (operation === "insert" && documentInserters[iface]) {
            return dispatch(documentInserters[iface](message.data));
        }

        if (operation === "update" && documentUpdaters[iface]) {
            return dispatch(documentUpdaters[iface](message.data));
        }

        if (operation === "delete" && documentRemovers[iface]) {
            return dispatch(documentRemovers[iface](message.data));
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
