import React from "react";
import ReactDOM from "react-dom";

import App from "./components/App";
import WSConnection from "virtool/js/websocket";
import { store } from "./store/createStore";


export * from "../css/bootstrap.css";
export * from "../css/font.css";
export * from "../css/roboto.css";
export * from "../css/perfect-scrollbar.css";
export * from "../css/typeahead.css";
export * from "../css/graphics.css";
export * from "../css/style.css";

window.ws = new WSConnection();
window.ws.establishConnection();

window.store = store;

ReactDOM.render(
    <App store={store} />,
    document.getElementById("app-container")
);
