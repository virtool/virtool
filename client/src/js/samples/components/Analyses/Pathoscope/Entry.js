import React from "react";
import CX from "classnames";
import PropTypes from "prop-types";
import { Row, Col } from "react-bootstrap";

import AnalysisValueLabel from "../ValueLabel";
import { Flex, FlexItem } from "../../../../base";
import { toScientificNotation } from "../../../../utils";

export default class PathoscopeEntry extends React.Component {

    static propTypes = {
        id: PropTypes.string,
        name: PropTypes.string,
        abbreviation: PropTypes.string,
        pi: PropTypes.number,
        best: PropTypes.number,
        maxDepth: PropTypes.number,
        reads: PropTypes.number,
        coverage: PropTypes.number,
        in: PropTypes.bool,
        toggleIn: PropTypes.func,
        showReads: PropTypes.bool
    };

    shouldComponentUpdate (nextProps) {
        return this.props.in !== nextProps.in || this.props.showReads !== nextProps.showReads;
    }

    toggleIn = () => {
        this.props.toggleIn(this.props.id);
    };

    render () {

        const className = CX("list-group-item", "spaced", {hoverable: !this.props.in});

        let closeButton;

        if (this.props.in) {
            closeButton = (
                <button type="button" className="close" onClick={this.toggleIn}>
                    <span>×</span>
                </button>
            );
        }

        const piValue = this.props.showReads ? Math.round(this.props.reads) : toScientificNotation(this.props.pi);

        return (
            <div className={className} onClick={this.props.in ? null : this.toggleIn}>
                <Row>
                    <Col xs={12} md={6}>
                        <Flex>
                            <FlexItem>
                                {this.props.name}
                            </FlexItem>
                            <FlexItem pad={5}>
                                <small className="text-primary">
                                    <strong className="text-warning">
                                        {this.props.abbreviation}
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
                            label={this.props.showReads ? "Reads" : "Weight"}
                            value={piValue}
                        />
                    </Col>
                    <Col xs={6} sm={4} md={2}>
                        <AnalysisValueLabel
                            bsStyle="danger"
                            label="Depth"
                            value={this.props.maxDepth}
                        />
                    </Col>
                    <Col xs={6} sm={4} md={2}>
                        <Flex justifyContent="space-between">
                            <FlexItem>
                                <AnalysisValueLabel
                                    bsStyle="primary"
                                    label="Coverage"
                                    value={this.props.coverage}
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
    }
}
