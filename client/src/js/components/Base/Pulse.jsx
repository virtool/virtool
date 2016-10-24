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

var React = require('react');

var Pulse = React.createClass({

    render: function () {

        return (
            <div className="spinner" style={{marginBottom: "-1px"}}>
                <div className="double-bounce1"></div>
                <div className="double-bounce2"></div>
            </div>
        );
    }

});

module.exports = Pulse;