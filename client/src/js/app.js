/**
 * Created by igboyes on 03/03/15.
 */

import React from "react";
import ReactDOM from "react-dom";
import Start from "./components/Start";

import Request from "superagent";
import Dispatcher from "virtool/js/dispatcher/main";

import * as bootstrap from "../css/bootstrap.css";
import * as font from "../css/font.css";
import * as roboto from "../css/roboto.css";
import * as perfectScrollbar from "../css/perfect-scrollbar.css";
import * as typeahead from "../css/typeahead.css";
import * as graphics from "../css/graphics.css";
import * as style from "../css/style.css";

window.dispatcher = new Dispatcher();
window.dispatcher.establishConnection();

Request
    .get("/api/account")
    .end((err, res) => {
        window.dispatcher.user.load(res.body);

        ReactDOM.render(React.createElement(Start), document.getElementById("app-container"));
    });


