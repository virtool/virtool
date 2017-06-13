import React from "react";
import ReactDOM from "react-dom";

import App from "./App";
import WSConnection from "virtool/js/websocket";
import { store } from "./store";
import { getAccount } from "./nav/actions";
import { getSettings } from "./settings/actions";

export * from "../style/style.less";

window.store = store;

window.ws = new WSConnection(store.dispatch);
window.ws.establishConnection();

window.store.dispatch(getAccount());
window.store.dispatch(getSettings());

ReactDOM.render(
    <App store={store} />,
    document.getElementById("app-container")
);
