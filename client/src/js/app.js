/**
 * Created by igboyes on 03/03/15.
 */

import React from "react";
import ReactDOM from "react-dom";
import Start from './components/Start';

document.write(require('../css/bootstrap.css'));
document.write(require('../css/bootstrap-toggle.css'));
document.write(require('../css/font.css'));
document.write(require('../css/roboto.css'));
document.write(require('../css/perfect-scrollbar.css'));
document.write(require('../css/typeahead.css'));
document.write(require('../css/graphics.css'));
document.write(require('../css/style.css'));

ReactDOM.render(React.createElement(Start), document.getElementById('app-container'));