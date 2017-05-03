import React from "react";
import ReactDOM from "react-dom";
import { Provider } from "react-redux";

import App from "./components/App";
import Router from "./router";
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

window.router = new Router();

ReactDOM.render(
    <Provider store={store}>
        <App />
    </Provider>,
    document.getElementById("app-container")
);
