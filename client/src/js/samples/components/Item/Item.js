import { find, includes } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { pushState } from "../../../app/actions";
import { Attribution, Checkbox, Icon, LinkBox, Loader } from "../../../base";
import { selectSample } from "../../actions";
import { getLibraryTypeDisplayName } from "../../utils";
import { SampleItemLabels } from "./Labels";

const SampleIconContainer = styled.div`
    align-items: center;
    background: none;
    bottom: 0;
    display: flex;
    justify-content: center;
    padding: 0 15px;
    position: absolute;
    right: 0;
    top: 0;
    z-index: 900;

    > div {
        align-items: center;
        display: flex;

        strong {
            margin-left: 5px;
        }
    }
`;

const SampleItemCheckboxContainer = styled.div`
    bottom: 0;
    cursor: pointer;
    display: flex;
    justify-content: center;
    left: 0;
    padding-top: 12px;
    top: 0;
    position: absolute;
    width: 45px;
    z-index: 900;
`;

const SampleItemContainer = styled.div`
    position: relative;
    z-index: 0;

    ${Attribution} {
        font-size: 12px;
    }
`;

const SampleItemLibraryType = styled.div`
    align-items: center;
    color: ${props => props.theme.color.greyDark};
    display: flex;
    flex: 1;
    font-weight: 600;

    i:first-child {
        margin-right: 10px;
    }
`;

const SampleItemLinkBox = styled(LinkBox)`
    align-items: center;
    display: flex;
    padding: 10px 45px 10px 45px;
    position: relative;
`;

const SampleItemTitle = styled.div`
    flex: 3;
    position: relative;

    h5 {
        margin: 0;
    }
`;

class SampleEntry extends React.Component {
    handleCheck = e => {
        this.props.onSelect(this.props.id, this.props.index, e.shiftKey);
    };

    render() {
        let endIcon;

        if (this.props.ready) {
            endIcon = (
                <SampleIconContainer>
                    <Icon
                        name="chart-area"
                        tip="Quick Analyze"
                        tipPlacement="left"
                        color="green"
                        onClick={this.props.onQuickAnalyze}
                        style={{ fontSize: "17px", zIndex: 10000 }}
                    />
                </SampleIconContainer>
            );
        } else {
            endIcon = (
                <SampleIconContainer>
                    <div>
                        <Loader size="14px" color="#3c8786" />
                        <strong>Creating</strong>
                    </div>
                </SampleIconContainer>
            );
        }

        return (
            <SampleItemContainer>
                <SampleItemCheckboxContainer onClick={this.handleCheck}>
                    <Checkbox checked={this.props.checked} />
                </SampleItemCheckboxContainer>

                <SampleItemLinkBox to={`/samples/${this.props.id}`}>
                    <SampleItemTitle>
                        <h5>{this.props.name}</h5>
                        <Attribution time={this.props.created_at} user={this.props.user.id} />
                    </SampleItemTitle>
                    <SampleItemLibraryType>
                        <Icon name={this.props.library_type === "amplicon" ? "barcode" : "dna"} fixedWidth />
                        <span> {getLibraryTypeDisplayName(this.props.library_type)}</span>
                    </SampleItemLibraryType>
                    <SampleItemLabels nuvs={this.props.nuvs} pathoscope={this.props.pathoscope} />
                </SampleItemLinkBox>

                {endIcon}
            </SampleItemContainer>
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
