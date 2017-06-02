import React from "react";
import ReactDOM from "react-dom";

import App from "./App";
import WSConnection from "virtool/js/websocket";
import { store } from "./store";
import { getAccount } from "./nav/actions";
import { getSettings } from "./settings/actions";

export * from "../style/style.less";

window.ws = new WSConnection();
window.ws.establishConnection();

window.store = store;

window.store.dispatch(getAccount());
window.store.dispatch(getSettings());

ReactDOM.render(
    <App store={store} />,
    document.getElementById("app-container")
);
