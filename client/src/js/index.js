import "./nonce";
import * as Sentry from "@sentry/browser";
import { createBrowserHistory } from "history";
import React from "react";
import ReactDOM from "react-dom";
import App from "./app/App";
import { createAppStore } from "./app/reducer";

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

ReactDOM.render(<App store={window.store} history={history} />, document.getElementById("app-container"));
