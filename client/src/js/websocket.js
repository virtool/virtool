import User from "./user";
import Router from "./router";

export default function WSConnection () {

    this.user = new User();
    this.router = new Router();

    // When a websocket message is received, this method is called with the message as the sole argument. Every message
    // has a property "operation" that tells the dispatcher what to do. Illegal operation names will throw an error.
    this.handle = (message) => {
        console.log(`${message.interface}.${message.operation}`); // eslint-disable-line
    };

    this.establishConnection = () => {

        var protocol = window.location.protocol === "https:" ? "wss" : "ws";

        this.connection = new window.WebSocket(`${protocol}://${window.location.host}/ws`);

        this.connection.onmessage = (event) => {
            dispatcher.handle(JSON.parse(event.data));
        };

        this.connection.onclose = () => {
            dispatcher.emit("closed");
        };
    };
}
