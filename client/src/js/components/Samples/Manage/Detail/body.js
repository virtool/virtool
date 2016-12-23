import React from "react";
import ResizeDetector from "react-resize-detector";
import { intersectionWith, difference } from "lodash";
import { Tab, Tabs } from "react-bootstrap";
import { Icon, Button, Modal, ConfirmFooter } from "virtool/js/components/Base";

var SampleDetailGeneral = require("./General/General");
var SampleDetailQuality = require("./Quality/Quality");
var SampleDetailAnalyses = require("./Analyses/Analyses");
var SampleDetailRights = require("./Rights/Rights");

var SampleDetail = React.createClass({

    getInitialState: function () {
        return {
            showProgress: false,
            activeKey: "general",
            analyses: null
        };
    },

    componentDidMount: function () {
        var analysisIds = dispatcher.db.analyses.find({sample_id: this.props.detail._id}.map(a => a["_id"]);

        this.retrieveAnalyses(analysisIds);

        dispatcher.db.analyses.on("change", this.onAnalysesChange);
    },

    componentWillUnmount: function () {
        dispatcher.db.analyses.off("change", this.onAnalysesChange);
    },

    retrieveAnalyses: function (analysisIds, mergeIn) {
        dispatcher.db.analyses.request("detail", {_id: analysisIds})
            .success(function (data) {
                if (mergeIn) {
                    data = data.concat(mergeIn);
                }

                this.setState({
                    analyses: data
                });
            }, this);
    },

    onAnalysesChange: function () {

        var nextAnalyses = dispatcher.db.analyses.find({sample_id: this.props.detail._id});

        var toRetain = intersectionWith(this.state.analyses, nextAnalyses, function (arrValue, othValue) {
            return arrValue._id === othValue._id && arrValue._version === othValue._version;
        });

        var toRetrieve = difference(
            nextAnalyses.map(a => a["_id"]),
            toRetain.map(a => a["_id"])
        );

        if (toRetrieve.length > 0) {
            this.retrieveAnalyses(toRetrieve, toRetain);
        }

        this.setState({
            analyses: toRetain.length === 0 ? null: toRetain
        });
    },

    handleSelect: function (eventKey) {
        this.setState({activeKey: eventKey});
    },

    handleResize: function () {
        this.props.updateStyle();
    },

    setProgress: function (value) {
        this.setState({
            showProgress: value
        });
    },

    remove: function () {
        dispatcher.db.samples.request('remove_sample', {_id: this.props.detail._id});
    },

    render: function () {

        var data = this.props.detail;
        
        var body;
        var footer;

        if (data.imported === true) {

            var isOwner = dispatcher.user.name === this.props.detail.username;

            var canModify = (
                data.all_write ||
                (data.group_write && dispatcher.user.groups.indexOf(data.group) > -1) ||
                isOwner
            );

            var buttonContent = (
                <span>
                    <Icon name='remove'/> Remove
                </span>
            );

            if (canModify) {
                footer = (
                    <ConfirmFooter
                        onHide={this.props.onHide}
                        buttonContent={buttonContent}
                        callback={this.remove}
                        message='Are you sure you want to delete this sample?'
                    />
                );
            }

            var tabContent;

            switch (this.state.activeKey) {

                case "general":
                    tabContent = (
                        <SampleDetailGeneral
                            {...this.props.detail}
                            canModify={canModify}
                        />
                    );
                    break;

                case "quality":
                    tabContent = <SampleDetailQuality {...this.props.detail} />;
                    break;

                case "analyses":
                    tabContent = (
                        <SampleDetailAnalyses
                            {...this.props.detail}
                            analyses={this.state.analyses}
                            canModify={canModify}
                            setProgress={this.setProgress}
                        />
                    );
                    break;

                case "rights":
                    tabContent = <SampleDetailRights {...this.props.detail} />;
                    break;

            }

            var tabsProps = {
                id: "sample-detail-tabs",
                activeKey: this.state.activeKey,
                onSelect: this.handleSelect
            };

            var rightsTab;

            if (isOwner || dispatcher.user.groups.indexOf('administrator') > -1) {
                rightsTab = <Tab eventKey="rights" title={<Icon name='key' />} />;
            }

            body = (
                <Tabs {...tabsProps}>
                    <Tab eventKey="general" title='General' />
                    <Tab eventKey="quality" title='Quality' />
                    <Tab eventKey="analyses" title='Analyses' />
                    {rightsTab}

                    <Tab.Content>
                        {tabContent}
                    </Tab.Content>
                </Tabs>
            );
        } else {
            body = (
                <div className='text-center'>
                    <p>Sample is being imported...</p>
                    <p><Icon name='spinner' pending={true} /></p>
                </div>
            );
        }

        return (
            <div>
                <ResizeDetector handleHeight handleWidth onResize={this.handleResize} />

                <Modal.Header>
                    {this.props.detail.name}
                </Modal.Header>

                <Modal.Progress active={this.state.showProgress} />

                <Modal.Body>
                    {body}
                </Modal.Body>

                {footer}
            </div>
        )
    }
});

module.exports = SampleDetail;