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
import PropTypes from "prop-types";
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
        id: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        created_at: PropTypes.string.isRequired,
        userId: PropTypes.string.isRequired,
        imported: stringOrBool.isRequired,
        pathoscope: stringOrBool.isRequired,
        nuvs: stringOrBool.isRequired,
        archived: PropTypes.bool.isRequired,
        selected: PropTypes.bool,
        selecting: PropTypes.bool,
        toggleSelect: PropTypes.func
    };

    static defaultProps = {
        selected: false,
        selecting: false
    };

    render () {

        const labels = mapValues({pathoscope: null, nuvs: null}, (value, key) =>
            <FlexItem className={CX("sample-label", {"bg-primary": this.props[key]})} pad>
                <Flex alignItems="center" className="hidden-xs visible-md">
                    {this.props[key] === "ip" ? <Spinner />: <Icon name="bars" />}
                    <span style={{paddingLeft: "3px"}}>
                        {key === "pathoscope" ? "Pathoscope" : "NuVs"}
                    </span>
                </Flex>

                <span className="visible-xs hidden-md">
                    {this.props[key] === "ip" ? <Spinner />: <strong>{key === "pathoscope" ? "P" : "N"}</strong>}
                </span>
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
            <LinkContainer className="spaced" to={`/samples/${this.props.id}`}>
                <ListGroupItem  onClick={this.props.selecting ? this.toggleSelect: this.showDetail}>
                    <Flex alignItems="center">
                        <FlexItem grow={0} style={{paddingRight: "12px"}}>
                            <Checkbox
                                checked={this.props.selected}
                                onClick={this.toggleSelect}
                                className="hidden-xs hidden-sm"
                            />
                            <Checkbox
                                checked={this.props.selected}
                                onClick={this.toggleSelect}
                                className="hidden-md hidden-lg"
                                style={{fontSize: "20px"}}
                            />
                        </FlexItem>

                        <FlexItem grow={1}>
                            <Row>
                                <Col xs={9} md={4}>
                                    <strong>{this.props.name}</strong>
                                </Col>

                                <Col xs={3} md={3}>
                                    <Flex>
                                        <FlexItem
                                            className={CX("bg-primary", "sample-label")}
                                        >
                                            <Flex alignItems="center">
                                                {this.props.imported === "ip" ? <Spinner />: <Icon name="filing" />}
                                                <span style={{paddingLeft: "3px"}} className="hidden-xs hidden-sm">
                                                    Import
                                                </span>
                                            </Flex>
                                        </FlexItem>
                                        {labels.pathoscope}
                                        {labels.nuvs}
                                    </Flex>
                                </Col>

                                <Col xs={5} md={3}>
                                    <span className="hidden-xs hidden-sm">
                                        Created <RelativeTime time={this.props.created_at} /> by {this.props.userId}
                                    </span>
                                    <span className="hidden-md hidden-lg">
                                        <Icon name="meter" /> <RelativeTime time={this.props.created_at} />
                                    </span>
                                </Col>

                                <Col xs={3} mdHidden lgHidden>
                                    <Icon name="user" /> {this.props.userId}
                                </Col>

                                <Col md={2} xsHidden smHidden>
                                    <Flex grow={0} shrink={0} className="pull-right">
                                        {analyzeIcon}
                                        {archiveIcon}
                                    </Flex>
                                </Col>
                            </Row>
                        </FlexItem>
                    </Flex>
                </ListGroupItem>
            </LinkContainer>
        );
    }
}
