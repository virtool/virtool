import React from "react";
import styled from "styled-components";
import PropTypes from "prop-types";
import { Row, Col } from "react-bootstrap";
import { SpacedBox } from "../../../base/index";
import NuVsExpansion from "./Expansion";

const StyledNuVsEntryValue = styled(Col)`
    small {
        margin-right: 3px;
    }
`;

const NuVsEntryValue = ({ label, value }) => (
    <StyledNuVsEntryValue xs={4} md={3}>
        <small className="text-muted text-strong">{label}</small>
        <strong>{value}</strong>
    </StyledNuVsEntryValue>
);

export default class NuVsEntry extends React.Component {
    static propTypes = {
        analysisId: PropTypes.string,
        blast: PropTypes.object,
        in: PropTypes.bool,
        index: PropTypes.number,
        maxSequenceLength: PropTypes.number,
        sequence: PropTypes.string,
        orfs: PropTypes.array,
        e: PropTypes.number,
        toggleIn: PropTypes.func
    };

    shouldComponentUpdate(nextProps) {
        return nextProps.in !== this.props.in;
    }

    handleToggleIn = () => {
        this.props.toggleIn(this.props.index);
    };

    render() {
        let expansion;

        if (this.props.in) {
            const { analysisId, blast, index, maxSequenceLength, orfs, sequence } = this.props;

            expansion = (
                <NuVsExpansion
                    index={index}
                    analysisId={analysisId}
                    blast={blast}
                    maxSequenceLength={maxSequenceLength}
                    orfs={orfs}
                    sequence={sequence}
                />
            );
        }

        return (
            <SpacedBox onClick={this.handleToggleIn}>
                <Row>
                    <Col xs={12} md={3}>
                        <strong>Sequence {this.props.index}</strong>
                    </Col>
                    <NuVsEntryValue label="LENGTH" value={this.props.sequence.length} />
                    <NuVsEntryValue label="E-VALUE" value={this.props.e} />
                    <NuVsEntryValue label="ORFS" value={this.props.orfs.length} />
                </Row>
                {expansion}
            </SpacedBox>
        );
    }
}
