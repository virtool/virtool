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

import React, { PropTypes } from "react";

export default class Pulse extends React.Component {

    static propTypes = {
        color: PropTypes.string
    };

    render () {

        let style;

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

}