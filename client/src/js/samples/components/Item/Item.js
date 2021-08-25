import { find } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { pushState } from "../../../app/actions";
import { getFontSize, getFontWeight } from "../../../app/theme";
import { Attribution, Box, Checkbox, Icon, Loader } from "../../../base";
import { selectSample } from "../../actions";
import { getIsSelected } from "../../selectors";
import { SampleLibraryTypeLabel, SmallSampleLabel } from "../Label";
import { SampleItemWorkflowTags } from "./Tags";

const SampleIconContainer = styled.div`
    align-items: center;
    background: none;
    bottom: 0;
    display: flex;
    justify-content: center;

    > div {
        align-items: center;
        display: flex;

        strong {
            margin-left: 5px;
        }
    }
`;

const SampleItemCheckboxContainer = styled.div`
    cursor: pointer;
    display: flex;
    padding-right: 15px;
`;

const SampleItemLabels = styled.div`
    margin-top: 10px;

    & > *:not(:last-child) {
        margin-right: 5px;
    }
`;

const SampleItemData = styled.div`
    display: flex;
    flex: 3;
    flex-direction: column;
`;

const SampleItemMain = styled.div`
    align-items: center;
    display: flex;
    position: relative;
`;

const SampleItemWorkflows = styled.div`
    display: flex;
    flex: 2;
`;

const SampleItemTitle = styled.div`
    display: flex;
    flex-direction: column;
    flex: 3;

    a {
        font-size: ${getFontSize("lg")};
        font-weight: ${getFontWeight("thick")};
        margin: 0;
    }
`;

const StyledSampleItem = styled(Box)`
    align-items: stretch;
    display: flex;
`;

class SampleItem extends React.Component {
    handleCheck = e => {
        this.props.onSelect(this.props.id, this.props.index, e.shiftKey);
    };

    handleQuickAnalyze = () => {
        this.props.onQuickAnalyze(this.props.id);
    };

    render() {
        let endIcon;

        if (this.props.ready) {
            endIcon = (
                <SampleIconContainer>
                    <Icon
                        color="green"
                        name="chart-area"
                        style={{ fontSize: "17px", zIndex: 10000 }}
                        tip="Quick Analyze"
                        tipPlacement="left"
                        onClick={this.handleQuickAnalyze}
                    />
                </SampleIconContainer>
            );
        } else {
            endIcon = (
                <SampleIconContainer>
                    <React.Fragment>
                        <Loader size="14px" color="primary" />
                        <strong>Creating</strong>
                    </React.Fragment>
                </SampleIconContainer>
            );
        }

        return (
            <StyledSampleItem>
                <SampleItemCheckboxContainer onClick={this.handleCheck}>
                    <Checkbox checked={this.props.checked} />
                </SampleItemCheckboxContainer>

                <SampleItemData>
                    <SampleItemMain>
                        <SampleItemTitle>
                            <Link to={`/samples/${this.props.id}`}>{this.props.name}</Link>
                            <Attribution time={this.props.created_at} user={this.props.user.id} />
                        </SampleItemTitle>
                    </SampleItemMain>
                    <SampleItemLabels>
                        <SampleLibraryTypeLabel libraryType={this.props.library_type} />
                        {this.props.labels.map(label => (
                            <SmallSampleLabel key={label.id} {...label} />
                        ))}
                    </SampleItemLabels>
                </SampleItemData>
                <SampleItemWorkflows>
                    <SampleItemWorkflowTags
                        id={this.props.id}
                        nuvs={this.props.nuvs}
                        pathoscope={this.props.pathoscope}
                    />
                </SampleItemWorkflows>
                {endIcon}
            </StyledSampleItem>
        );
    }
}

export const mapStateToProps = (state, ownProps) => ({
    ...find(state.samples.documents, { id: ownProps.id }),
    checked: getIsSelected(state, ownProps.id)
});

export const mapDispatchToProps = (dispatch, ownProps) => ({
    onSelect: () => {
        dispatch(selectSample(ownProps.id));
    },
    onQuickAnalyze: id => {
        dispatch(selectSample(id));
        dispatch(pushState({ quickAnalysis: true }));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(SampleItem);
