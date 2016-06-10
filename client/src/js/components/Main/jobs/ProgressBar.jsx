/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports ProgressBar
 */

'use strict';

var React = require('react');

/**
 * A component that renders a Bootstrap progress bar based on the state of a Virtool job and its progress value
 * (eg. 0.2).
 *
 * @class
 */
var ProgressBar = React.createClass({

    propTypes: {
        state: React.PropTypes.string.isRequired,
        value: React.PropTypes.number.isRequired
    },

    render: function () {
        // The label text to show in the progress bar.
        var label = '';

        // The value (0 < x < 100) used to fill the progress bar.
        var fill;

        // Classes to give the progress bar. Affect colouring and striping.
        var barClass = 'progress-bar progress-bar-';

        // A text element to be shown in an empty progress bar, indicating that the job is waiting.
        var waitingText = null;

        switch (this.props.state) {

            case 'waiting':
                // Empty bar with 'Waiting' label.
                waitingText = <span className='waiting-text'>Waiting</span>;
                fill = 0;
                break;

            case 'running':
                // Partially filled blue, animated bar with no label.
                label = null;
                barClass += 'striped active';
                fill = this.props.value * 100;
                break;

            case 'error':
                // Full red bar with 'Error' label.
                label = 'Error';
                barClass += 'danger';
                fill = 100;
                break;

            case 'cancelled':
                // Full red bar with 'Cancelled' label.
                label = 'Cancelled';
                barClass += 'danger';
                fill = 100;
                break;

            case 'complete':
                label = 'Complete';
                fill = 100;
                break;
        }

        return (
            <div className='progress'>
                {waitingText}
                <div className={barClass} aria-valuenow={fill} aria-valuemin='0' aria-valuemax='100' style={{width: fill + '%'}}>
                    <span>{label}</span>
                </div>
            </div>
        )
    }
});

module.exports = ProgressBar;