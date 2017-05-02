/**
 * Created by igboyes on 03/03/15.
 */

import React from "react";
import ReactDOM from "react-dom";
import Start from "./components/Start";

import Request from "superagent";
import Dispatcher from "virtool/js/dispatcher";

export * from "../css/bootstrap.css";
export * from "../css/font.css";
export * from "../css/roboto.css";
export * from "../css/perfect-scrollbar.css";
export * from "../css/typeahead.css";
export * from "../css/graphics.css";
export * from "../css/style.css";

window.dispatcher = new Dispatcher();
window.dispatcher.establishConnection();

Request
    .get("/api/account")
    .end((err, res) => {
        window.dispatcher.user.load(res.body);

        ReactDOM.render(React.createElement(Start), document.getElementById("app-container"));
    });


