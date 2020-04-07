import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { Button, Icon, LinkButton, SearchInput, Toolbar } from "../../base";
import { checkRefRight } from "../../utils/utils";
import { findOTUs } from "../actions";

export const FilterButton = styled(Button)`
    border: 1px solid #cbd5e0;
    color: black;
`;

export class OTUToolbar extends React.Component {
    find = e => {
        this.props.onFind(this.props.refId, e.target.value, this.props.verified, 1);
    };

    filterVerified = () => {
        this.props.onFind(this.props.refId, this.props.term, !this.props.verified, 1);
    };

    render() {
        const { canModify, term, verified } = this.props;

        let createButton;

        if (canModify) {
            createButton = (
                <LinkButton to={{ state: { createOTU: true } }} color="blue" tip="Create" icon="plus-square" replace />
            );
        }

        return (
            <Toolbar>
                <SearchInput placeholder="Name or abbreviation" value={term} onChange={this.find} />

                <FilterButton
                    id="verified-button"
                    tip="Filter Unverified"
                    onClick={this.filterVerified}
                    active={verified}
                >
                    <Icon name="filter" />
                </FilterButton>

                {createButton}
            </Toolbar>
        );
    }
}

const mapStateToProps = state => {
    const { page, term, verified } = state.otus;
    return {
        canModify: !state.references.detail.remotes_from && checkRefRight(state, "modify_otu"),
        refId: state.references.detail.id,
        page,
        term,
        verified
    };
};

const mapDispatchToProps = dispatch => ({
    onFind: (refId, term, verified) => {
        dispatch(findOTUs(refId, term, verified, 1));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(OTUToolbar);
