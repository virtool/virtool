import React from "react";
import ReactDOM from "react-dom";
import FlipMove from "react-flip-move";
import {FormGroup, InputGroup, FormControl, ButtonGroup} from "react-bootstrap";
import CreateSample from "./Create/Create";

var SampleList = require("./List.jsx");
var SampleSelector = require('./Selector.jsx');
var SampleDetail = require('./Detail/body.jsx');

var QuickAnalyze = require('./QuickAnalyze.jsx');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var Flex = require('virtool/js/components/Base/Flex.jsx');
var PushButton = require('virtool/js/components/Base/PushButton.jsx');
var DetailModal = require('virtool/js/components/Base/DetailModal.jsx');

var SampleController = React.createClass({

    propTypes: {
        route: React.PropTypes.object,
        documents: React.PropTypes.object
    },

    getInitialState: function () {
        return {
            findTerm: "",

            selected: [],

            imported: false,
            analyzed: false,
            archived: false,

            canCreate: dispatcher.user.permissions.add_sample
        };
    },

    componentDidMount: function () {
        dispatcher.user.on('change', this.onUserChange);
        ReactDOM.findDOMNode(this.refs.name).focus();
    },

    componentWillReceiveProps: function (nextProps) {
        if (this.state.selected.length > 0) {
            this.setState({
                selected: _.intersection(this.state.selected, _.map(nextProps.documents, "_id"))
            });
        }
    },

    componentWillUnmount: function () {
        dispatcher.user.off('change', this.onUserChange);
    },

    setFindTerm: function (event) {
        this.setState({
            findTerm: event.target.value
        });
    },

    toggleFlag: function (name) {
        var state = {};
        state[name] = !this.state[name]
        this.setState(state);
    },

    select: function (sampleIds) {
        this.setState({
            selected: sampleIds
        });
    },

    toggleSelect: function (sampleIds) {
        this.setState({
            selected: _.xor(sampleIds.constructor === Array ? sampleIds: [sampleIds], this.state.selected)
        });
    },

    selectNone: function () {
        this.setState({
            selected: []
        });
    },

    create: function () {
        dispatcher.router.setExtra(["create"]);
    },

    hideModal: function () {
        dispatcher.router.clearExtra();
    },

    onUserChange: function () {
        this.setState({
            canCreate: dispatcher.user.permissions.add_sample
        });
    },

    render: function () {

        var documents = this.props.documents.branch().find({
            archived: this.state.archived
        });

        if (this.state.imported) {
            documents = documents.find({imported: true});
        }

        if (this.state.analyzed) {
            documents = documents.find({analyzed: true});
        }

        if (this.state.findTerm) {
            var test = {$regex: [this.state.findTerm, "i"]};

            documents = documents.find({$or: [
                {name: test},
                {username: test}
            ]});
        }

        documents = documents.simplesort("name").data();

        var toolbar;
        var selector;
        var selectedDocuments = [];

        if (this.state.selected.length === 0) {

            toolbar = (
                <div key="toolbar">
                    <Flex>
                        <Flex.Item grow={1}>
                            <FormGroup>
                                <InputGroup>
                                    <InputGroup.Addon>
                                        <Icon name='search' /> Find
                                    </InputGroup.Addon>
                                    <FormControl
                                        type='text'
                                        ref='name'
                                        onChange={this.setFindTerm}
                                        placeholder='Sample name'
                                    />
                                </InputGroup>
                            </FormGroup>
                        </Flex.Item>

                        <Flex.Item shrink={0} pad>
                            <ButtonGroup>
                                <PushButton active={!this.state.archived} onClick={this.state.archived ? function () {this.toggleFlag("archived")}.bind(this): null} tip="Show Active">
                                    <Icon name="play" />
                                </PushButton>
                                <PushButton active={this.state.archived} onClick={this.state.archived ? null: function () {this.toggleFlag("archived")}.bind(this)} tip="Show Archived">
                                    <Icon name="box-add" />
                                </PushButton>
                            </ButtonGroup>
                        </Flex.Item>

                        <Flex.Item pad>
                            <PushButton active={this.state.imported} onClick={function () {this.toggleFlag("imported")}.bind(this)} tip="Show Imported" disabled={this.state.archived}>
                                <Icon name="filing" />
                            </PushButton>
                        </Flex.Item>
                        <Flex.Item pad>
                            <PushButton active={this.state.analyzed} onClick={function () {this.toggleFlag("analyzed")}.bind(this)} tip="Show Analyzed" disabled={this.state.archived}>
                                <Icon name="bars" />
                            </PushButton>
                        </Flex.Item>

                        <Flex.Item key="create" shrink={0} pad>
                            <PushButton bsStyle='primary' onClick={this.create} disabled={this.state.archived}>
                                <Icon name='new-entry'/> Create
                            </PushButton>
                        </Flex.Item>
                    </Flex>
                </div>
            );
        } else {

            documents = documents.map(function (document) {
                var isSelected = _.includes(this.state.selected, document._id);

                isSelected ? selectedDocuments.push(document): allSelected = false;

                return _.merge({selected: isSelected}, document);
            }.bind(this));

            selector = (
                <SampleSelector
                    key="selector"
                    archived={this.state.archived}

                    selected={selectedDocuments}
                    selectNone={this.selectNone}
                />
            );
        }

        var detailTarget;

        if (this.props.route.extra[0] === "detail") {
            detailTarget = dispatcher.db.samples.findOne({_id: this.props.route.extra[1]});
        }

        return (
            <div>
                <FlipMove typeName="div" duration={150} enterAnimation="fade" leaveAnimation="fade">
                    {toolbar}

                    {selector}

                    <div key="list">
                        <SampleList
                            route={this.props.route}
                            documents={documents}

                            select={this.select}
                            toggleSelect={this.toggleSelect}
                            selecting={this.state.selected.length > 0}
                        />
                    </div>
                </FlipMove>

                <CreateSample
                    show={this.props.route.extra[0] === "create"}
                    onHide={this.hideModal}
                />

                <QuickAnalyze
                    show={this.props.route.extra.length === 2 && this.props.route.extra[0] === "quick-analyze"}
                    sampleId={this.props.route.extra[1]}
                    onHide={this.hideModal}
                />

                <DetailModal
                    target={detailTarget}
                    onHide={this.hideModal}
                    contentComponent={SampleDetail}
                    collection={dispatcher.db.samples}
                />
            </div>
        );
    }
});

module.exports = SampleController;
