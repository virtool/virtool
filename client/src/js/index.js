import * as Sentry from "@sentry/browser";
import { createBrowserHistory } from "history";
import React from "react";
import ReactDOM from "react-dom";
import { getAccount } from "./account/actions";
import { getSettings } from "./administration/actions";
import App from "./app/App";
import { createAppStore } from "./app/reducer";
import WSConnection from "./app/websocket";
import { listProcesses } from "./processes/actions";

export * from "../style/style.less";

if (!window.virtool.dev) {
    Sentry.init({
        dsn: "https://d9ea493cb0f34ad4a141da5506e6b03b@sentry.io/220541",
        version: window.virtool.version
    });

    window.Sentry = Sentry;
}

const history = createBrowserHistory();

window.store = createAppStore(history);
window.ws = new WSConnection(window.store);
window.ws.establishConnection();

window.store.dispatch(getAccount());
window.store.dispatch(getSettings());
window.store.dispatch(listProcesses());

ReactDOM.render(<App store={window.store} history={history} />, document.getElementById("app-container"));
