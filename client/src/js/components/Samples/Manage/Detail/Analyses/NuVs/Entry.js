import CX from "classnames";
import React from "react";
import { Row, Col, Label } from "react-bootstrap";
import { Flex, FlexItem } from "virtool/js/components/Base";

export default class NuVsEntry extends React.Component {
    
    static propTypes = {
        in: React.PropTypes.bool,
        index: React.PropTypes.number,
        sequence: React.PropTypes.string,
        orfs: React.PropTypes.array,
        minE: React.PropTypes.number,
        toggleIn: React.PropTypes.func
    };

    shouldComponentUpdate (nextProps) {
        return nextProps.in !== this.props.in;
    }

    render () {

        const flexStyle = {
            height: "21px"
        };

        const className = CX({
            "list-group-item": true,
            "hoverable": !this.props.in,
            "spaced": true
        });

        let closeButton;

        if (this.props.in) {
            closeButton = (
                <FlexItem grow={0} shrink={0}>
                    <button type="button" className="close" onClick={this.toggleIn}>
                        <span>×</span>
                    </button>
                </FlexItem>
            );
        }

        return (
            <div className={className} onClick={() => {if (!this.props.in) this.props.toggleIn(this.props.index)}}>
                <Row>
                    <Col md={3}>
                        <strong>Sequence {this.props.index}</strong>
                    </Col>
                    <Col md={3}>
                        <Flex alignItems="center" style={flexStyle}>
                            <FlexItem>
                                <Label>Length</Label>
                            </FlexItem>
                            <FlexItem pad={5}>
                                <strong className="text-primary">
                                    {this.props.sequence.length}
                                </strong>
                            </FlexItem>
                        </Flex>
                    </Col>
                    <Col md={3}>
                        <Flex alignItems="center" style={flexStyle}>
                            <FlexItem>
                                <Label>E-value</Label>
                            </FlexItem>
                            <FlexItem pad={5}>
                                <strong className="text-danger">
                                    {this.props.minE}
                                </strong>
                            </FlexItem>
                        </Flex>
                    </Col>
                    <Col md={3}>
                        <Flex>
                            <FlexItem grow={1} shrink={0}>
                                <Flex alignItems="center" style={flexStyle}>
                                    <FlexItem>
                                        <Label>ORFs</Label>
                                    </FlexItem>
                                    <FlexItem pad={5}>
                                        <strong className="text-success">
                                            {this.props.orfs.length}
                                        </strong>
                                    </FlexItem>
                                </Flex>
                            </FlexItem>
                            {closeButton}
                        </Flex>
                    </Col>
                </Row>
            </div>
        );
    }
}
