import React from "react";
import CX from "classnames";
import PropTypes from "prop-types";
import { Row, Col } from "react-bootstrap";
import { Flex, FlexItem } from "../../../base/index";

export default class NuVsEntry extends React.Component {
    static propTypes = {
        in: PropTypes.bool,
        index: PropTypes.number,
        sequence: PropTypes.string,
        orfs: PropTypes.array,
        minE: PropTypes.number,
        toggleIn: PropTypes.func
    };

    shouldComponentUpdate(nextProps) {
        return nextProps.in !== this.props.in;
    }

    handleToggleIn = () => {
        this.props.toggleIn(this.props.index);
    };

    render() {
        const className = CX("list-group-item", "spaced", {
            hoverable: !this.props.in
        });

        let closeButton;

        if (this.props.in) {
            closeButton = (
                <FlexItem grow={0} shrink={0}>
                    <button type="button" className="close" onClick={this.handleToggleIn}>
                        <span>×</span>
                    </button>
                </FlexItem>
            );
        }

        return (
            <div className={className} onClick={this.props.in ? null : this.handleToggleIn}>
                <Row>
                    <Col md={3}>
                        <strong>Sequence {this.props.index}</strong>
                    </Col>
                    <Col md={3}>
                        <Flex alignItems="center">
                            <small className="text-muted text-strong">LENGTH</small>
                            <FlexItem pad>
                                <strong>{this.props.sequence.length}</strong>
                            </FlexItem>
                        </Flex>
                    </Col>
                    <Col md={3}>
                        <Flex alignItems="center">
                            <small className="text-muted text-strong">E-VALUE</small>
                            <FlexItem pad>
                                <strong>{this.props.minE}</strong>
                            </FlexItem>
                        </Flex>
                    </Col>
                    <Col md={3}>
                        <Flex alignItems="center">
                            <small className="text-muted text-strong">ORFS</small>
                            <FlexItem grow={1} pad>
                                <strong>{this.props.orfs.length}</strong>
                            </FlexItem>
                            <FlexItem pad>{closeButton}</FlexItem>
                        </Flex>
                    </Col>
                </Row>
            </div>
        );
    }
}
