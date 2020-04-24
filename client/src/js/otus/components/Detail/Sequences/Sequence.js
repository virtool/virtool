import PropTypes from "prop-types";
import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { BoxGroupSection } from "../../../../base";
import { followDownload } from "../../../../utils/utils";
import { SequenceButtons } from "./Buttons";
import { SequenceTable } from "./Table";

const SequenceHeader = styled.div`
    align-items: flex-start;
    display: flex;
`;

const SequenceValue = styled.div`
    display: flex;
    flex-direction: column;
    min-width: 0;

    p,
    small {
        margin: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    small {
        color: ${props => props.theme.color.greyDark};
        font-size: ${props => props.theme.fontSize.sm};
        font-weight: bold;
        text-transform: uppercase;
    }
`;

const SequenceAccession = styled(SequenceValue)`
    width: 100px;
    margin-right: 20px;
`;

const SequenceTitle = styled(SequenceValue)`
    flex: 1;
`;

class Sequence extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            in: false
        };
    }

    static propTypes = {
        id: PropTypes.string,
        accession: PropTypes.string,
        definition: PropTypes.string,
        host: PropTypes.string,
        segment: PropTypes.string,
        sequence: PropTypes.string,
        showEditSequence: PropTypes.func,
        showRemoveSequence: PropTypes.func,
        canModify: PropTypes.bool,
        dataType: PropTypes.string,
        name: PropTypes.string,
        description: PropTypes.string,
        required: PropTypes.string,
        target: PropTypes.string,
        length: PropTypes.number
    };

    handleCloseClick = () => {
        this.setState({ in: false });
    };

    handleDownload = () => {
        followDownload(`/download/sequences/${this.props.id}`);
    };

    handleShowEditSequence = () => {
        this.props.showEditSequence(this.props.id);
    };

    handleShowRemoveSequence = () => {
        this.props.showRemoveSequence(this.props.id);
    };

    render() {
        const accession = this.props.accession;

        let buttons;

        if (this.state.in) {
            buttons = (
                <SequenceButtons
                    canModify={this.props.canModify}
                    onCollapse={this.handleCloseClick}
                    onDownload={this.handleDownload}
                    onShowEdit={this.handleShowEditSequence}
                    onShowRemove={this.handleShowRemoveSequence}
                />
            );
        }

        let table;

        if (this.state.in) {
            table = (
                <SequenceTable
                    definition={this.props.definition}
                    host={this.props.host}
                    segment={this.props.segment}
                    sequence={this.props.sequence}
                    target={this.props.target}
                />
            );
        }

        const title = this.props.segment || this.props.target || this.props.definition;

        let titleLabel = "DEFINITION";

        if (this.props.segment) {
            titleLabel = "SEGMENT";
        }

        if (this.props.target) {
            titleLabel = "TARGET";
        }

        return (
            <BoxGroupSection onClick={this.state.in ? null : () => this.setState({ in: true })}>
                <SequenceHeader>
                    <SequenceAccession>
                        <p>{accession}</p>
                        <small>ACCESSION</small>
                    </SequenceAccession>
                    <SequenceTitle>
                        <p>{title}</p>
                        <small>{titleLabel}</small>
                    </SequenceTitle>
                    {buttons}
                </SequenceHeader>
                {table}
            </BoxGroupSection>
        );
    }
}

const mapStateToProps = state => ({
    dataType: state.references.detail.data_type,
    targets: state.references.detail.targets
});

export default connect(mapStateToProps)(Sequence);
