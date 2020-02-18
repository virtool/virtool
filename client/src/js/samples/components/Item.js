import { find, includes } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { pushState } from "../../app/actions";
import { Checkbox, Flex, FlexItem, Icon, Loader, RelativeTime, LinkBox } from "../../base";
import { selectSample } from "../actions";

const StyledItems = styled(LinkBox)`
    display: grid;
    grid-template-columns: 2fr 2fr 3fr auto;
    grid-gap: 30px;
    user-select: none;

    @media (max-width: 1000px) {
        grid-template-columns: 3fr 4fr auto;
    }
`;

const SampleEntryLabelIcon = styled.span`
    margin-right: 3px;
    width: 12px;
`;

const StyledSampleEntryLabel = styled.div`
    align-items: center;
    background-color: ${props => (props.ready ? "#07689d" : "#ffffff")};
    border: 1px solid ${props => (props.ready ? "#07689d" : "#dddddd")};
    border-radius: 2px;
    color: ${props => (props.ready ? "#ffffff" : "#333333")};
    display: flex;
    font-size: 11px;
    font-weight: bold;
    margin-right: 5px;
    padding: 2px 4px;
`;

export const SampleEntryLabel = ({ icon, label, ready }) => (
    <StyledSampleEntryLabel ready={ready}>
        <SampleEntryLabelIcon>
            {ready === "ip" ? (
                <Loader size="10px" color="white" verticalAlign="middle" />
            ) : (
                <Icon name={icon} style={{ lineHeight: "inherit" }} fixedWidth />
            )}
        </SampleEntryLabelIcon>
        <span className="sample-label-text">{label}</span>
    </StyledSampleEntryLabel>
);

const StyledSampleEntryLabels = styled.div`
    align-items: center;
    display: flex;

    @media (max-width: 1000px) {
        display: none;
    }
`;

export const SampleEntryLabels = ({ nuvs, pathoscope }) => (
    <StyledSampleEntryLabels>
        <SampleEntryLabel icon="chart-area" label="Pathoscope" ready={pathoscope} />
        <SampleEntryLabel icon="chart-area" label="NuVs" ready={nuvs} />
    </StyledSampleEntryLabels>
);

class SampleEntry extends React.Component {
    handleCheck = e => {
        this.props.onSelect(this.props.id, this.props.index, e.shiftKey);
    };

    render() {
        let analyzeIcon;
        let spinner;

        if (this.props.ready) {
            analyzeIcon = (
                <div className="sample-icon-overlay">
                    <Icon
                        name="chart-area"
                        tip="Quick Analyze"
                        tipPlacement="left"
                        bsStyle="success"
                        onClick={this.props.onQuickAnalyze}
                        style={{ fontSize: "17px", zIndex: 10000 }}
                        pullRight
                    />
                </div>
            );
        } else {
            spinner = (
                <Flex alignItems="center" className="pull-right">
                    <Loader size="14px" color="#3c8786" />
                    <FlexItem pad>
                        <strong>Creating</strong>
                    </FlexItem>
                </Flex>
            );
        }

        return (
            <div className="sample-item-container">
                <div className="sample-checkbox-overlay" onClick={this.handleCheck} />
                {analyzeIcon}
                <StyledItems to={`/samples/${this.props.id}`}>
                    <span>
                        <Checkbox className="no-select" checked={this.props.checked} />
                        <strong style={{ marginLeft: "12px" }}>{this.props.name}</strong>
                    </span>
                    <SampleEntryLabels {...this.props} />
                    <span>
                        Created <RelativeTime time={this.props.created_at} /> by {this.props.user.id}
                    </span>
                    {spinner}
                </StyledItems>
            </div>
        );
    }
}

const mapStateToProps = (state, ownProps) => ({
    ...find(state.samples.documents, { id: ownProps.id }),
    checked: includes(state.samples.selected, ownProps.id)
});

const mapDispatchToProps = (dispatch, ownProps) => ({
    onSelect: () => {
        dispatch(selectSample(ownProps.id));
    },
    onQuickAnalyze: () => {
        dispatch(pushState({ createAnalysis: [ownProps.id] }));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(SampleEntry);
