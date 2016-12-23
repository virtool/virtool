/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports JobLog
 */

'use strict';

import React from "react";
var Panel = require('react-bootstrap/lib/Panel');
var Button = require('react-bootstrap/lib/Button');

var Icon = require('virtool/js/components/Base/Icon');

/**
 * A react-bootstrap button that does not retain focus when clicked.
 */
var JobLog = React.createClass({
    
    getInitialState: function () {
        return {
            show: false
        };
    },
    
    toggle: function () {
        this.setState({show: !this.state.show});
    },

    render: function () {
        if (this.state.show) {

            var lineComponents = this.props.log.map(function (line, index) {
                return <pre key={index}>{line}</pre>
            });

            var panelHeader = (
                <span>
                    <Icon name='file-text' /> Detailed Log
                    <span className='pull-right close no-select' onClick={this.toggle}>×</span>
                </span>
            );

            var overflowStyle = {
                height: '400px',
                overflowY: 'scroll',
                margin: '-15px'
            };

            var containerStyle = {
                padding: '15px'
            };

            return (
                <Panel header={panelHeader}>
                    <div style={overflowStyle}>
                        <div style={containerStyle}>
                            {lineComponents}
                        </div>
                    </div>
                </Panel>
            );
        }

        return (
            <Button className={this.props.pullRight ? 'pull-right': null} onClick={this.toggle} block>
                <Icon name='file-text' /> Detailed Log
            </Button>
        );
    }

});

module.exports = JobLog;