'use strict';

var _ = require('lodash');
var CX = require('classnames');
var React = require('react');
var Progress = require('rc-progress').Circle;
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var Flex = require('virtool/js/components/Base/Flex.jsx');

var PushButton = require('virtool/js/components/Base/PushButton.jsx');
var RelativeTime = require('virtool/js/components/Base/RelativeTime.jsx');

var AnalysisItem = React.createClass({

    getInitialState: function () {
        return {
            pending: false,
            progress: this.props.ready ? 0: dispatcher.db.jobs.findOne({_id: this.props.job}).progress
        };
    },
    
    componentDidMount: function () {
        if (!this.props.ready) {
            dispatcher.db.jobs.on('update', this.onJobUpdate);
        }
    },

    componentDidUpdate: function (prevProps) {
        if (!prevProps.ready && this.props.ready) {
            dispatcher.db.jobs.off('update', this.onJobUpdate);
        }
    },
    
    componentWillUnmount: function () {
        if (!this.props.ready) {
            dispatcher.db.jobs.off('update', this.onJobUpdate)
        }
    },

    handleClick: function () {
        if (!this.disabled && this.props.ready) {
            this.props.selectAnalysis(this.props._id);
        }
    },

    remove: function () {
        this.props.setProgress(true);

        this.setState({pending: true}, function () {
            dispatcher.db.analyses.request('remove_analysis', {
                _id: this.props._id
            })
            .success(function () {
                this.props.setProgress(false);
                this.setState({pending: false});
            }, this)
            .failure(function () {
                this.props.setProgress(false);
                this.setState({pending: false});
            }, this);
        });
    },

    onJobUpdate: function () {
        var job = dispatcher.db.jobs.findOne({_id: this.props.job});

        if (job.progress !== this.state.progress) {
            this.setState({progress: job.progress});
        }
    },

    render: function () {
        
        var removeIcon;

        if (this.props.ready && !this.state.pending && this.props.canModify) {
            removeIcon = (
                <Icon
                    name='remove'
                    bsStyle='danger'
                    onClick={this.remove}
                    pullRight
                />
            );
        }

        var itemClass = CX({
            'list-group-item': true,
            'disabled': this.props.disabled || !this.props.ready,
            'hoverable': !this.props.disabled && this.props.ready
        });

        return (
            <div className={itemClass} onClick={this.handleClick}>
                <Row>
                    <Col sm={3} >
                        {this.props.name || 'Unnamed Analysis'}
                    </Col>
                    <Col sm={3} >
                        {this.props.algorithm === 'nuvs' ? 'NuVs': _.upperFirst(_.camelCase(this.props.algorithm))}
                    </Col>
                    <Col md={2}>
                        Index v{this.props.index_version}
                    </Col>
                    <Col md={4}>
                        Created <RelativeTime time={this.props.timestamp} /> by {this.props.username}
                        {removeIcon}
                    </Col>
                </Row>
            </div>
        );
    }
});

module.exports = AnalysisItem;