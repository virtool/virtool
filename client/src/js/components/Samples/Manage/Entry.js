/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports SampleEntry
 */


import React from "react";
import { Row, Col } from "react-bootstrap";
import { ListGroupItem, Icon, Flex, FlexItem, Pulse, Checkbox, RelativeTime } from "virtool/js/components/Base";
import { stringOrBool } from "virtool/js/propTypes";

/**
 * A form-based component used to filter the documents presented in JobsTable component.
 *
 * @class
 */
export default class SampleEntry extends React.Component {

    constructor (props) {
        super(props);
        this.state = {
            pendingQuickAnalyze: false
        };
    }

    static propTypes = {
        _id: React.PropTypes.string.isRequired,
        name: React.PropTypes.string.isRequired,
        added: React.PropTypes.string.isRequired,
        username: React.PropTypes.string.isRequired,
        imported: stringOrBool,
        analyzed: stringOrBool,
        archived: React.PropTypes.bool.isRequired,
        selected: React.PropTypes.bool,
        selecting: React.PropTypes.bool,
        toggleSelect: React.PropTypes.func
    };

    static defaultProps = {
        imported: false,
        analyzed: false,
        archived: false,
        selected: false,
        selecting: false
    };

    showDetail = () => {
        dispatcher.router.setExtra(["detail", this.props._id]);
    };

    quickAnalyze = (event) => {
        event.stopPropagation();

        if (dispatcher.user.settings.skip_quick_analyze_dialog) {
            this.setState({pendingQuickAnalyze: true}, () => {
                dispatcher.db.samples.request("analyze", {
                    samples: [this.props._id],
                    algorithm: dispatcher.user.settings.quick_analyze_algorithm,
                    name: null
                })
                .success(() => {
                    this.setState({pendingQuickAnalyze: false})
                })
                .failure(() => {
                    this.setState({pendingQuickAnalyze: false})
                })
            });
        } else {
            dispatcher.router.setExtra(["quick-analyze", this.props._id]);
        }
    };

    toggleSelect = (event) => {
        event.stopPropagation();
        this.props.toggleSelect(this.props._id);
    };

    archive = (event) => {
        event.stopPropagation();
        dispatcher.db.samples.request("archive", {_id: this.props._id});
    };

    render () {

        let analysisLabel;

        if (this.props.analyzed) {
            analysisLabel = (
                <FlexItem className="bg-primary sample-label" pad>
                    {this.props.analyzed === "ip" ? <Pulse />: <Icon name="bars" />} Analysis
                </FlexItem>
            );
        }

        let analyzeIcon;
        let archiveIcon;

        if (!this.props.selected) {
            analyzeIcon = (
                <FlexItem>
                    <Icon
                        name="bars"
                        tip="Quick Analyze"
                        tipPlacement="left"
                        bsStyle="success"
                        onClick={this.quickAnalyze}
                    />
                </FlexItem>
            );

            if (this.props.analyzed === true && !this.props.archived) {
                archiveIcon = (
                    <FlexItem pad={5}>
                        <Icon
                            name="box-add"
                            tip="Archive"
                            tipPlacement="top"
                            bsStyle="info"
                            onClick={this.archive}
                        />
                    </FlexItem>
                );

            }
        }

        return (
            <ListGroupItem className="spaced" onClick={this.props.selecting ? this.toggleSelect: this.showDetail}>
                <Row>
                    <Col md={4}>
                        <Flex>
                            <FlexItem>
                                <Checkbox checked={this.props.selected} onClick={this.toggleSelect} />
                            </FlexItem>
                            <FlexItem grow={1} pad={10}>
                                <strong>{this.props.name}</strong>
                            </FlexItem>
                        </Flex>
                    </Col>
                    <Col md={3}>
                        <Flex>
                            <FlexItem className="bg-primary sample-label">
                                {this.props.imported === true ? <Icon name="filing" />: <Pulse />} Import
                            </FlexItem>
                            {analysisLabel}
                        </Flex>
                    </Col>
                    <Col md={3}>
                        Added <RelativeTime time={this.props.added} /> by {this.props.username}
                    </Col>
                    <Col md={2}>
                        <Flex className="pull-right">
                            {analyzeIcon}
                            {archiveIcon}
                        </Flex>
                    </Col>
                </Row>
            </ListGroupItem>
        );
    }
}
