import createHistory from "history/createBrowserHistory";
import React from "react";
import ReactDOM from "react-dom";
import Raven from "raven-js";
import App from "./app/App";
import { createAppStore } from "./app/reducer";
import WSConnection from "./app/websocket";
import { getAccount } from "./account/actions";
import { getSettings } from "./administration/actions";
import { listProcesses } from "./processes/actions";

export * from "../style/style.less";

Raven.config("https://d9ea493cb0f34ad4a141da5506e6b03b@sentry.io/220541").install();

window.Raven = Raven;

const history = createHistory();

window.store = createAppStore(history);
window.ws = new WSConnection(window.store.dispatch);
window.ws.establishConnection();

window.store.dispatch(getAccount());
window.store.dispatch(getSettings());
window.store.dispatch(listProcesses());

ReactDOM.render(<App store={window.store} history={history} />, document.getElementById("app-container"));
