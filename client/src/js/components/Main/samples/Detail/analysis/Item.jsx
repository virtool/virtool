/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports AnalysisItem
 */

'use strict';

var _ = require('lodash');
var CX = require('classnames');
var React = require('react');
var Progress = require('rc-progress').Circle;
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var ListGroupItem = require('virtool/js/components/Base/PushListGroupItem.jsx');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var Flex = require('virtool/js/components/Base/Flex.jsx');

var PushButton = require('virtool/js/components/Base/PushButton.jsx');
var RelativeTime = require('virtool/js/components/Base/RelativeTime.jsx');

/**
 * A ListGroupItem-based component the represents an analysis document. A child component of AnalysisList.
 *
 * @class
 */
var AnalysisItem = React.createClass({

    getInitialState: function () {
        return {
            pending: false,
            progress: this.props.ready ? 0: _.find(dispatcher.collections.jobs.documents, {_id: this.props.job}).progress
        };
    },
    
    componentDidMount: function () {
        if (!this.props.ready) dispatcher.collections.jobs.on('update', this.onJobUpdate);
    },

    componentDidUpdate: function (prevProps) {
        if (!prevProps.ready && this.props.ready) dispatcher.collections.jobs.off('update', this.onJobUpdate);
    },
    
    componentWillUnmount: function () {
        if (!this.props.ready) dispatcher.collections.jobs.off('update', this.onJobUpdate);
    },

    /**
     * Makes detailed information for this analysis document visible. Triggered by clicking this component.
     *
     * @func
     */
    handleClick: function () {
        if (!this.disabled && this.props.ready) {
            this.props.selectAnalysis(this.props._id);
        }
    },

    /**
     * Remove an analysis record by sending a request to the server. Triggered by a click event on the red trashcan
     * icon.
     *
     * @func
     */
    remove: function () {
        this.setState({pending: true}, function () {
            dispatcher.collections.samples.request('remove_analysis', {
                _id: this.props.sample,
                analysis_id: this.props._id
            }, null, this.onFailure);
        });
    },

    /**
     * Called if a remove request fails. Removes pending state.
     *
     * @func
     */
    onFailure: function () {
        this.setState({pending: false});
    },

    onJobUpdate: function (data) {
        if (data[0]._id === this.props.job) {
            this.setState({progress: data[0].progress});
        }
    },

    render: function () {
        
        var rightIcon;

        var hidden = {
            visibility: 'hidden'
        };

        if (this.props.ready) {
            rightIcon = (
                <Icon
                    name='remove'
                    bsStyle={this.props.canModify ? 'danger': null}
                    pending={!this.props.ready || this.state.pending}
                    onClick={this.props.canModify ? this.remove: null}
                    style={this.props.canModify ? null: hidden}
                />
            );
        } else {
            rightIcon = (
                <div className='pull-right' style={{height: '14px', width: '14px'}}>
                    <Progress
                        percent={this.state.progress * 100}
                        strokeWidth={14}
                        strokeColor="#337ab7"
                    />
                </div>
            );
        }

        var itemClass = CX({
            'list-group-item': true,
            'disabled': this.props.disabled || !this.props.ready,
            'hoverable': !this.props.disabled && this.props.ready
        });

        return (
            <div className={itemClass} onClick={this.handleClick}>
                <Flex>
                    <Flex.Item grow={1}>
                        <Col sm={3} >
                            {this.props.comments || 'Unnamed Analysis'}
                        </Col>
                        <Col sm={3} >
                            {_.capitalize(this.props.algorithm)}
                        </Col>
                        <Col md={2}>
                            Index v{this.props.index_version}
                        </Col>
                        <Col md={4}>
                            Created <RelativeTime time={this.props.timestamp} /> by {this.props.username}
                        </Col>
                    </Flex.Item>

                    <Flex.Item>
                        {rightIcon}
                    </Flex.Item>
                </Flex>
            </div>
        );
    }
});

module.exports = AnalysisItem;