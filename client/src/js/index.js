import React from "react";
import ReactDOM from "react-dom";

import App from "./App";
import WSConnection from "./websocket";
import { store } from "./store";
import { getAccount } from "./nav/actions";
import { getSettings } from "./settings/actions";

export * from "../style/style.less";

window.store = store;

window.ws = new WSConnection(store.dispatch);
window.ws.establishConnection();

window.store.dispatch(getAccount());
window.store.dispatch(getSettings());

window.addEventListener("beforeunload", () => {
    if (!window.store.getState().files.uploadsComplete) {
        return "hello world";
    }
});

ReactDOM.render(
    <App store={store} />,
    document.getElementById("app-container")
);
