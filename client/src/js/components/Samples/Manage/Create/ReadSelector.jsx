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
var FlipMove = require('react-flip-move');
var ListGroup = require('react-bootstrap/lib/ListGroup');
var Overlay = require('react-bootstrap/lib/Overlay');
var Popover = require('react-bootstrap/lib/Popover');
var Panel = require('react-bootstrap/lib/Panel');
var Label = require('react-bootstrap/lib/Label');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Modal = require('react-bootstrap/lib/Modal');

import ReadItem from "./ReadItem";
var Icon = require('virtool/js/components/Base/Icon.jsx');
var Input = require('virtool/js/components/Base/Input.jsx');
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
            files: dispatcher.db.files.find({file_type: "reads", "ready": true}),
            filter: '',
            showAll: false
        };
    },

    shouldComponentUpdate: function (nextProps) {
        return !_.isEqual(nextProps.selected, this.props.selected) || nextProps.readError != this.props.readError;
    },

    handleSelect: function (selectedId) {
        let selected = this.props.selected.slice(0);

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
        dispatcher.db.files.on('change', this.update);
    },

    componentWillUnmount: function () {
        // Unbind all callbacks
        dispatcher.db.files.off('change', this.update);
    },

    update: function () {
        var files = dispatcher.db.files.find({file_type: "reads", "ready": true});

        this.setState({files: files}, function () {
            this.props.select(_.intersection(this.props.selected, _.map(files, '_id')));
        });
    },

    getPanelDOMNode: function () {
        return ReactDOM.findDOMNode(this.refs.panel);
    },

    render: function () {

        console.log(this.state.files);

        const loweredFilter = this.state.filter.toLowerCase();

        let files = _.clone(this.state.files);

        if (!this.state.showAll) {
            files = _.filter(files, file => {
                return (
                    _.endsWith(file.name, '.fastq') ||
                    _.endsWith(file.name, '.fq') ||
                    _.endsWith(file.name, '.fastq.gz') ||
                    _.endsWith(file.name, '.fq.gz')
                );
            });
        }

        const fileComponents = _.sortBy(files, 'timestamp').reverse().map((file) => {
            if (file.name.toLowerCase().indexOf(loweredFilter) > -1) {
                return (
                    <ReadItem
                        key={file._id}
                        {...file}
                        selected={_.includes(this.props.selected, file._id)}
                        onSelect={this.handleSelect}
                    />
                );
            }
        });

        let overlay;

        if (this.props.readError) {
            // Set up an overlay to display if there is an error in state.
            const overlayProps = {
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
                    Read Files <Label>{this.props.selected.length}/{fileComponents.length} selected</Label>
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
                        <FlipMove typeName="div" className="list-group" fill={true}>
                            {fileComponents}
                        </FlipMove>
                    </Panel>
                </Panel>

                {overlay}
            </div>
        );
    }
});

module.exports = ReadSelector;