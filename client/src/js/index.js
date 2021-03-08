import * as Sentry from "@sentry/browser";
import { createBrowserHistory } from "history";
import "./nonce";
import "normalize.css";
import React from "react";
import ReactDOM from "react-dom";
import App from "./app/App";
import { createAppStore } from "./app/reducer";

if (!window.virtool.dev) {
    Sentry.init({
        dsn: "https://d9ea493cb0f34ad4a141da5506e6b03b@sentry.io/220541",
        version: window.virtool.version
    });

    window.Sentry = Sentry;
}

window.captureException = error => (window.virtool.dev ? console.error(error) : window.Sentry.captureException(error));

const history = createBrowserHistory();

window.store = createAppStore(history);

ReactDOM.render(<App store={window.store} history={history} />, document.getElementById("app-container"));
