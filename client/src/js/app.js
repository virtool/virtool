/**
 * Created by igboyes on 03/03/15.
 */

import React from "react";
import ReactDOM from "react-dom";
import Start from "./components/Start";

import * as bootstrap from "../css/bootstrap.css";
import * as font from "../css/font.css";
import * as roboto from "../css/roboto.css";
import * as perfectScrollbar from "../css/perfect-scrollbar.css";
import * as typeahead from "../css/typeahead.css";
import * as graphics from "../css/graphics.css";
import * as style from "../css/style.css";

document.write(bootstrap);
document.write(font);
document.write(roboto);
document.write(perfectScrollbar);
document.write(typeahead);
document.write(graphics);
document.write(style);

ReactDOM.render(React.createElement(Start), document.getElementById("app-container"));
