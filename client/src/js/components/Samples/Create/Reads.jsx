/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports ReadSelector
 */

'use strict';

var _ = require('lodash');
var React = require('react');
var ReactDOM = require('react-dom');
var ListGroup = require('react-bootstrap/lib/ListGroup');
var Overlay = require('react-bootstrap/lib/Overlay');
var Popover = require('react-bootstrap/lib/Popover');
var Input = require('react-bootstrap/lib/Input');
var Panel = require('react-bootstrap/lib/Panel');
var Label = require('react-bootstrap/lib/Label');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Modal = require('react-bootstrap/lib/Modal');

var ReadItem = require('./Read.jsx');
var Icon = require('virtool/js/components/Base/Icon.jsx');
var PushButton = require('virtool/js/components/Base/PushButton.jsx');

/**
 * A main view for importing samples from FASTQ files. Importing starts an import job on the server.
 *
 * @class
 */
var ReadSelector = React.createClass({

    propTypes: {
        selected: React.PropTypes.arrayOf(React.PropTypes.string)
    },

    getInitialState: function () {
        return {
            reads: dispatcher.db.reads.find(),
            filter: '',
            showAll: false
        };
    },

    handleSelect: function (selectedId) {
        var selected = this.props.selected.slice(0);

        if (_.includes(selected, selectedId)) {
            _.pull(selected, selectedId);
        } else {
            if (this.props.selected.length === 2) selected.shift();
            selected.push(selectedId);
        }

        this.props.select(selected);
    },

    handleFilter: function (event) {
        this.setState({
            filter: event.target.value
        });
    },

    reset: function () {
        this.setState({filter: ''}, function () {
            this.props.select([]);
        });
    },

    toggleShowAll: function () {
        this.setState({
            showAll: !this.state.showAll
        });
    },

    componentDidMount: function () {
        // Listen for changes to the reads collection
        dispatcher.listen('reads');
        dispatcher.db.reads.on('change', this.update);
    },

    componentWillUnmount: function () {
        // Unbind all callbacks
        dispatcher.unlisten('reads');
        dispatcher.db.reads.off('change', this.update);
    },

    update: function () {
        var reads = dispatcher.db.reads.find();

        this.setState({reads: reads}, function () {
            this.props.select(_.intersection(this.props.selected, _.map(reads, '_id')));
        });
    },

    getPanelDOMNode: function () {
        return ReactDOM.findDOMNode(this.refs.panel);
    },

    render: function () {

        var loweredFilter = this.state.filter.toLowerCase();

        var reads = _.clone(this.state.reads);

        if (!this.state.showAll) {
            reads = _.filter(reads, function (read) {
                return (
                    _.endsWith(read._id, '.fastq') ||
                    _.endsWith(read._id, '.fq') ||
                    _.endsWith(read._id, '.fastq.gz') ||
                    _.endsWith(read._id, '.fq.gz')
                );
            });
        }

        var readComponents = _.sortBy(reads, '_id').map(function (read) {
            if (read._id.toLowerCase().indexOf(loweredFilter) > -1) {
                return (
                    <ReadItem
                        key={read._id}
                        {...read}
                        selected={_.includes(this.props.selected, read._id)}
                        onSelect={this.handleSelect}
                    />
                );
            }
        }, this);

        var overlay;

        if (this.props.readError) {
            // Set up an overlay to display if there is an error in state.
            var overlayProps = {
                target: this.getPanelDOMNode,
                animation: false,
                placement: 'top'
            };

            overlay = (
                <Overlay {...overlayProps} show={true}>
                    <Popover id='read-error-popover'>
                        <span className='text-danger'>At least one read file must be attached to the sample</span>
                    </Popover>
                </Overlay>
            );
        }
        
        return (
            <div>
                <label className='control-label'>
                    Read Files <Label>{this.props.selected.length}/{readComponents.length} selected</Label>
                </label>

                <Panel ref='panel'>
                    <div style={{display: 'flex'}}>
                        <div style={{flex: '1 1 auto'}}>
                            <Input
                                type="text"
                                onChange={this.handleFilter}
                                value={this.state.filter}
                                placeholder="Filter by filename..."
                            />
                        </div>
                        <div style={{flex: '0 0 auto', paddingLeft: '5px'}}>
                            <PushButton onClick={this.reset}>
                                <Icon name='reset' /> Clear
                            </PushButton>
                        </div>
                        <div style={{flex: '0 0 auto', paddingLeft: '5px'}}>
                            <PushButton onClick={this.toggleShowAll} active={this.state.showAll}>
                                <Icon name='eye' /> Show All
                            </PushButton>
                        </div>
                    </div>

                    <Panel style={{minHeight: '420px', maxHeight: '420px', overflowY: 'scroll'}}>
                        <ListGroup fill>
                            {readComponents}
                        </ListGroup>
                    </Panel>
                </Panel>

                {overlay}
            </div>
        );
    }
});

module.exports = ReadSelector;