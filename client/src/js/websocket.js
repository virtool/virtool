import { wsUpdateJob, wsRemoveJob, findJobs } from "./jobs/actions";


export default function WSConnection (dispatch) {

    // The Redux store's dispatch method.
    this.dispatch = dispatch;

    // When a websocket message is received, this method is called with the message as the sole argument. Every message
    // has a property "operation" that tells the dispatcher what to do. Illegal operation names will throw an error.
    this.handle = (message) => {
        console.log(`${message.interface}.${message.operation}`); // eslint-disable-line

        if (message.operation === "update") {
            if (message.interface === "jobs") {
                dispatch(findJobs());
            }
        }

        if (message.operation === "remove") {
            if (message.interface === "jobs") {
                dispatch(wsRemoveJob(message.data.job_id));
            }
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
