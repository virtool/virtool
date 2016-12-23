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

'use strict';

import React from "react";
var Icon = require('virtool/js/components/Base/Icon');

var LoadingOverlay = React.createClass({

    propTypes: {
        // Show is set to true when the overlay should appear in its parent.
        show: React.PropTypes.bool.isRequired,
        text: React.PropTypes.string
    },

    getDefaultProps: function () {
        // By default the loading is text is simply 'Loading'.
        return {text: 'Loading'}
    },

    render: function () {
        if (this.props.show) {
            // The overlay element. Centered text and a centered spinning icon immediately below it.
            return (
                <div className='loading-overlay'>
                    <div>
                        <p>{this.props.text}</p>
                        <Icon name='spinner' pending={true} />
                    </div>
                </div>
            )
        }

        return <div/>;
    }

});

module.exports = LoadingOverlay;