import { wsUpdateJob, wsRemoveJob } from "./jobs/actions";
import { wsUpdateFile, wsRemoveFile } from "./files/actions";

const documentUpdaters = {
    jobs: wsUpdateJob,
    files: wsUpdateFile
};

const wsUpdateDocument = (iface, data) => {
    return documentUpdaters[iface](data);
};

const documentRemovers = {
    jobs: wsRemoveJob,
    files: wsRemoveFile
};

const wsRemoveDocument = (iface, data) => {
    return documentRemovers[iface](data);
};

export default function WSConnection (dispatch) {

    // The Redux store's dispatch method.
    this.dispatch = dispatch;

    // When a websocket message is received, this method is called with the message as the sole argument. Every message
    // has a property "operation" that tells the dispatcher what to do. Illegal operation names will throw an error.
    this.handle = (message) => {
        window.console.log(`${message.interface}.${message.operation}`);

        switch (message.operation) {
            case "update":
                dispatch(wsUpdateDocument(message.interface, message.data));
                break;

            case "remove":
                dispatch(wsRemoveDocument(message.interface, message.data));
        }
    };

    this.establishConnection = () => {

        const protocol = window.location.protocol === "https:" ? "wss" : "ws";

        this.connection = new window.WebSocket(`${protocol}://${window.location.host}/ws`);

        this.connection.onmessage = (event) => {
            this.handle(JSON.parse(event.data));
        };

        this.connection.onclose = () => {
            this.emit("closed");
        };
    };
}
