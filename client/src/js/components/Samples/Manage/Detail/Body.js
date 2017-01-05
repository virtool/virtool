import React from "react";
import ResizeDetector from "react-resize-detector";
import { intersectionWith, difference } from "lodash";
import { Tab, Tabs } from "react-bootstrap";
import { Icon, Modal, ConfirmFooter } from "virtool/js/components/Base";

import SampleDetailGeneral from "./General";
import SampleDetailQuality from "./Quality/Quality";
import SampleDetailAnalyses from "./Analyses/Analyses";
import SampleDetailRights from "./Rights";

export default class SampleDetail extends React.Component {

    constructor (props) {
        super(props);
        this.state = {
            showProgress: false,
            activeKey: "general",
            analyses: null
        };
    }

    static propTypes = {
        detail: React.PropTypes.object,
        updateStyle: React.PropTypes.func,
        onHide: React.PropTypes.func
    };

    componentDidMount () {
        const analysisIds = dispatcher.db.analyses.find({sample_id: this.props.detail._id}.map(a => a["_id"]));

        this.retrieveAnalyses(analysisIds);

        dispatcher.db.analyses.on("change", this.onAnalysesChange);
    }

    componentWillUnmount () {
        dispatcher.db.analyses.off("change", this.onAnalysesChange);
    }

    retrieveAnalyses = (analysisIds, mergeIn) => {
        dispatcher.db.analyses.request("detail", {_id: analysisIds})
            .success((data) => {
                if (mergeIn) {
                    data = data.concat(mergeIn);
                }

                this.setState({
                    analyses: data
                });
            });
    };

    onAnalysesChange = () => {

        const nextAnalyses = dispatcher.db.analyses.find({sample_id: this.props.detail._id});

        const toRetain = intersectionWith(this.state.analyses, nextAnalyses, (arrValue, othValue) =>
            arrValue._id === othValue._id && arrValue._version === othValue._version
        );

        const toRetrieve = difference(
            nextAnalyses.map(a => a["_id"]),
            toRetain.map(a => a["_id"])
        );

        if (toRetrieve.length > 0) {
            this.retrieveAnalyses(toRetrieve, toRetain);
        }

        this.setState({
            analyses: toRetain.length === 0 ? null: toRetain
        });
    };

    handleSelect = (eventKey) => this.setState({activeKey: eventKey});

    handleResize = () => this.props.updateStyle();

    setProgress = (value) => this.setState({showProgress: value});

    remove = () => dispatcher.db.samples.request("remove_sample", {_id: this.props.detail._id});

    render () {

        const data = this.props.detail;
        
        let body;
        let footer;

        if (data.imported === true) {

            const isOwner = dispatcher.user.name === this.props.detail.username;

            const canModify = (
                data.all_write ||
                (data.group_write && dispatcher.user.groups.indexOf(data.group) > -1) ||
                isOwner
            );

            const buttonContent = (
                <span>
                    <Icon name="remove"/> Remove
                </span>
            );

            if (canModify) {
                footer = (
                    <ConfirmFooter
                        onHide={this.props.onHide}
                        buttonContent={buttonContent}
                        callback={this.remove}
                        message="Are you sure you want to delete this sample?"
                    />
                );
            }

            let tabContent;

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

            let rightsTab;

            if (isOwner || dispatcher.user.groups.indexOf("administrator") > -1) {
                rightsTab = <Tab eventKey="rights" title={<Icon name="key" />} />;
            }

            body = (
                <Tabs
                    id="sample-detail-tabs"
                    activeKey={this.state.activeKey}
                    onSelect={this.handleSelect}
                >
                    <Tab eventKey="general" title="General" />
                    <Tab eventKey="quality" title="Quality" />
                    <Tab eventKey="analyses" title="Analyses" />
                    {rightsTab}

                    <Tab.Content>
                        {tabContent}
                    </Tab.Content>
                </Tabs>
            );
        } else {
            body = (
                <div className="text-center">
                    <p>Sample is being imported...</p>
                    <p><Icon name="spinner" pending={true} /></p>
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
}
