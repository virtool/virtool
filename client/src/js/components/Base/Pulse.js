/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Pulse
 */

'use strict';

import React from "react";

var Pulse = React.createClass({

    render: function () {

        var style;

        if (this.props.color) {
            style = {
                backgroundColor: "#337ab7"
            }
        }

        return (
            <div className="spinner">
                <div className="double-bounce1" style={style}></div>
                <div className="double-bounce2" style={style}></div>
            </div>
        );
    }

});

module.exports = Pulse;