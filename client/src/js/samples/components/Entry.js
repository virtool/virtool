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
import { push } from "react-router-redux";
import { connect } from "react-redux";
import { mapValues } from "lodash";
import { Row, Col } from "react-bootstrap";

import { analyze } from "../actions";
import { Icon, Flex, FlexItem, RelativeTime } from "../../base";

class SampleEntry extends React.Component {

    constructor (props) {
        super(props);
        this.state = {
            pendingQuickAnalyze: false
        };
    }

    handleQuickAnalyze = (event) => {
        event.stopPropagation();
        if (this.props.skipDialog) {
            this.props.onAnalyze(this.props.id, this.props.algorithm || "pathoscope_bowtie");
        } else {
            this.props.onQuickAnalyze(this.props.id, this.props.name);
        }
    };

    render () {

        const labels = mapValues({pathoscope: null, nuvs: null}, (value, key) =>
            <FlexItem className={CX("sample-label", {"bg-primary": this.props[key]})} pad>
                <Flex alignItems="center" className="hidden-xs hidden-sm">
                    <Icon name={this.props[key] === "ip" ? "play": "bars"} />
                    <span style={{paddingLeft: "3px"}}>
                        {key === "pathoscope" ? "Pathoscope": "NuVs"}
                    </span>
                </Flex>

                <Flex alignItems="center" className="hidden-md hidden-lg">
                    {this.props[key] === "ip" ? <Icon name="play" />:
                        <strong>{key === "pathoscope" ? "P": "N"}</strong>
                    }
                </Flex>
            </FlexItem>
        );

        const analyzeIcon = (
            <Icon
                name="bars"
                tip="Quick Analyze"
                tipPlacement="left"
                bsStyle="success"
                onClick={this.handleQuickAnalyze}
                style={{fontSize: "17px", zIndex: 10000}}
                pullRight
            />
        );

        return (
            <div className="list-group-item hoverable spaced" onClick={() => this.props.onNavigate(this.props.id)}>
                <Flex alignItems="center">
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
                                            <Icon name={this.props.imported === "ip" ? "play": "filing"} />
                                            <span style={{paddingLeft: "3px"}} className="hidden-xs hidden-sm">
                                                Import
                                            </span>
                                        </Flex>
                                    </FlexItem>
                                    {labels.pathoscope}
                                    {labels.nuvs}
                                </Flex>
                            </Col>

                            <Col xs={5} md={4}>
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

                            <Col md={1} xsHidden smHidden>
                                {analyzeIcon}
                            </Col>
                        </Row>
                    </FlexItem>
                </Flex>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        skipDialog: state.account.settings.skip_quick_analyze_dialog,
        algorithm: state.account.settings.quick_analyze_algorithm
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onNavigate: (sampleId) => {
            dispatch(push(`/samples/${sampleId}`));
        },

        onAnalyze: (id, algorithm) => {
            dispatch(analyze(id, algorithm));
        },

        onQuickAnalyze: (id, name) => {
            dispatch(push({state: {quickAnalyze: {id, name}}}));
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(SampleEntry);

export default Container;
