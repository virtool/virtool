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
import CX from "classnames";
import { mapValues } from "lodash";
import { LinkContainer } from "react-router-bootstrap";
import { Row, Col } from "react-bootstrap";

import { ListGroupItem, Icon, Flex, FlexItem, Checkbox, RelativeTime, Spinner } from "virtool/js/components/Base";
import { stringOrBool } from "virtool/js/propTypes";

export default class SampleEntry extends React.Component {

    constructor (props) {
        super(props);
        this.state = {
            pendingQuickAnalyze: false
        };
    }

    static propTypes = {
        sampleId: React.PropTypes.string.isRequired,
        name: React.PropTypes.string.isRequired,
        added: React.PropTypes.string.isRequired,
        userId: React.PropTypes.string.isRequired,
        imported: stringOrBool.isRequired,
        pathoscope: stringOrBool.isRequired,
        nuvs: stringOrBool.isRequired,
        archived: React.PropTypes.bool.isRequired,
        selected: React.PropTypes.bool,
        selecting: React.PropTypes.bool,
        toggleSelect: React.PropTypes.func
    };

    static defaultProps = {
        selected: false,
        selecting: false
    };

    render () {

        const labels = mapValues({pathoscope: null, nuvs: null}, (value, key) =>
            <FlexItem className={CX("sample-label", {"bg-primary": this.props[key]})} pad>
                <Flex alignItems="center">
                    {this.props[key] === "ip" ? <Spinner />: <Icon name="bars" />}
                    <span style={{paddingLeft: "3px"}}>
                        {key === "pathoscope" ? "Pathoscope" : "NuVs"}
                    </span>
                </Flex>
            </FlexItem>
        );

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
                        style={{fontSize: "17px"}}
                    />
                </FlexItem>
            );

            if (this.props.nuvs === true || this.props.pathoscope === true && !this.props.archived) {
                archiveIcon = (
                    <FlexItem pad={5}>
                        <Icon
                            name="box-add"
                            tip="Archive"
                            tipPlacement="top"
                            bsStyle="info"
                            onClick={this.archive}
                            style={{fontSize: "17px"}}
                        />
                    </FlexItem>
                );

            }
        }

        return (
            <LinkContainer className="spaced" to={`/samples/${this.props.sampleId}`}>
                <ListGroupItem  onClick={this.props.selecting ? this.toggleSelect: this.showDetail}>
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
                                <FlexItem
                                    className={CX("bg-primary", "sample-label")}
                                >
                                    <Flex alignItems="center">
                                        {this.props.imported === "ip" ? <Spinner />: <Icon name="filing" />}
                                        <span style={{paddingLeft: "3px"}}>Import</span>
                                    </Flex>
                                </FlexItem>
                                {labels.pathoscope}
                                {labels.nuvs}
                            </Flex>
                        </Col>
                        <Col md={3}>
                            Created <RelativeTime time={this.props.added} /> by {this.props.userId}
                        </Col>
                        <Col md={2}>
                            <Flex className="pull-right">
                                {analyzeIcon}
                                {archiveIcon}
                            </Flex>
                        </Col>
                    </Row>
                </ListGroupItem>
            </LinkContainer>
        );
    }
}
