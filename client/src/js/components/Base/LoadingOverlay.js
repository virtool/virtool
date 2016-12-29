/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports LoadingOverlay
 */

import React from "react";
import Icon from "./";

export default class LoadingOverlay extends React.Component {

    propTypes = {
        show: React.PropTypes.bool.isRequired,
        text: React.PropTypes.string
    };

    defaultProps = {
        text: "Loading"
    };

    render () {
        if (this.props.show) {
            // The overlay element. Centered text and a centered spinning icon immediately below it.
            return (
                <div className="loading-overlay">
                    <div>
                        <p>{this.props.text}</p>
                        <Icon name="spinner" pending={true} />
                    </div>
                </div>
            )
        }

        return <div/>;
    }

}
