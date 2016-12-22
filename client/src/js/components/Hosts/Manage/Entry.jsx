/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports HostEntry
 */

'use strict';

import React from "react";
import {sortBy} from "lodash";
import Flex from "virtool/js/components/Base/Flex.jsx";
import ListGroupItem from "virtool/js/components/Base/PushListGroupItem.jsx";
var Progress = require('rc-progress').Circle;

/**
 * A component that serves as an document row in the hosts table.
 */
var HostEntry = React.createClass({

    getInitialState: function () {
        return {
            progress: this.getProgress()
        };
    },

    componentDidMount: function () {
        if (this.state.progress !== 1) dispatcher.db.jobs.on('update', this.onJobChange);
    },

    shouldComponentUpdate: function (nextProps, nextState) {
        return this.props.ready !== nextProps.ready || this.state.progress != nextState.progress;
    },

    componentDidUpdate: function (prevProps, prevState) {
        if (prevState.progress < 1 && this.state.progress === 1) {
            dispatcher.db.jobs.off('update', this.onJobChange);
        }
    },

    componentWillUnmount: function () {
        dispatcher.db.jobs.off('update', this.onJobChange);
    },

    onJobChange: function () {
        this.setState({
            progress: this.getProgress()
        });
    },

    getProgress: function () {
        if (this.props.added) return 1;

        var document = dispatcher.db.jobs.findOne({_id: this.props.job});
        return document ? document.progress: 0;
    },

    /**
     * Triggers showing a modal with details about the host associated with the document. Triggered by clicking the document.
     *
     * @func
     */
    handleClick: function () {
        this.props.showModal(pick(this.props, ['_id']));
    },

    render: function () {

        var progressIcon;

        if (this.state.progress < 1) {
            progressIcon = (
                <Flex.Item>
                    <div style={{height: '14px', width: '14px', marginTop: '2px'}}>
                        <Progress
                            percent={this.state.progress * 100}
                            strokeWidth={14}
                            strokeColor="#337ab7"
                            trailColor="#000000"
                        />
                    </div>
                </Flex.Item>
            );
        }

        return (
            <ListGroupItem onClick={this.handleClick} disabled={!this.props.added}>
                <Flex>
                    <Flex.Item grow={1}>
                        {this.props._id}
                    </Flex.Item>
                    {progressIcon}
                </Flex>
            </ListGroupItem>
        );
    }
});

module.exports = HostEntry;