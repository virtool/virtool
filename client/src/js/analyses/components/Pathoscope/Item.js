import CX from "classnames";
import React from "react";
import { Col, Row } from "react-bootstrap";
import { connect } from "react-redux";
import { Flex, FlexItem } from "../../../base/index";
import { toScientificNotation } from "../../../utils";
import { toggleExpanded } from "../../actions";

import AnalysisValueLabel from "../ValueLabel";

export const PathoscopeItem = (props) => {

    const className = CX("list-group-item", "spaced", {hoverable: !props.expanded});

    let closeButton;

    if (props.expanded) {
        closeButton = (
            <button type="button" className="close" onClick={() => props.onExpand(props.id)}>
                <span>×</span>
            </button>
        );
    }

    const piValue = props.showReads ? Math.round(props.reads) : toScientificNotation(props.pi);

    return (
        <div className={className} onClick={props.expanded ? null : () => props.onExpand(props.id)}>
            <Row>
                <Col xs={12} md={6}>
                    <Flex>
                        <FlexItem>
                            {props.name}
                        </FlexItem>
                        <FlexItem pad={5}>
                            <small className="text-primary">
                                <strong className="text-warning">
                                    {props.abbreviation}
                                </strong>
                            </small>
                        </FlexItem>
                    </Flex>
                </Col>

                <Col xs={12} mdHidden lgHidden>
                    <div style={{height: "20px"}} />
                </Col>

                <Col xs={6} sm={4} md={2}>
                    <AnalysisValueLabel
                        bsStyle="success"
                        label={props.showReads ? "Reads" : "Weight"}
                        value={piValue}
                    />
                </Col>
                <Col xs={6} sm={4} md={2}>
                    <AnalysisValueLabel
                        bsStyle="danger"
                        label="Depth"
                        value={props.depth.toFixed(1)}
                    />
                </Col>
                <Col xs={6} sm={4} md={2}>
                    <Flex justifyContent="space-between">
                        <FlexItem>
                            <AnalysisValueLabel
                                bsStyle="primary"
                                label="Coverage"
                                value={props.coverage.toFixed(3)}
                            />
                        </FlexItem>
                        <FlexItem>
                            {closeButton}
                        </FlexItem>
                    </Flex>
                </Col>
            </Row>
        </div>
    );
};

const mapStateToProps = (state, ownProps) => ({
    ...state.analyses.data[ownProps.index],
    showMedian: state.analyses.showMedian,
    showReads: state.analyses.showReads
});

const mapDispatchToProps = (dispatch) => ({

    onExpand: (id) => {
        dispatch(toggleExpanded(id));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(PathoscopeItem);
