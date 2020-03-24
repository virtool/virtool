import { toNumber } from "lodash-es";
import React, { useCallback } from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { DropdownButton, DropdownItem, Icon, Input, SearchInput } from "../../../base";
import { setAnalysisSortKey, setAODPFilter, setSearchIds } from "../../actions";
import { getFuse } from "../../selectors";

const sortTitles = {
    identity: "Identity"
};

const StyledAODPToolBar = styled.div`
    display: grid;
    grid-template-columns: 3fr 1fr 1fr;
    grid-gap: 5px;
`;

const StyledSortDropdownButtonTitle = styled.div`
    align-items: center;
    display: flex;
    width: 106px;

    i {
        margin-left: auto;
    }
`;

export const AODPToolBar = ({ filterAODP, fuse, id, sortKey, onSearch, onSelect, onSetFilter }) => {
    const handleChangeSearch = useCallback(
        e => {
            onSearch(e.target.value, fuse);
        },
        [id]
    );

    const handleChangeFilter = e => {
        onSetFilter(toNumber(e.target.value));
    };

    const title = (
        <StyledSortDropdownButtonTitle>
            <span>
                <Icon name="sort" /> Sort: {sortTitles[sortKey]}
            </span>
            <Icon name="caret-down" />
        </StyledSortDropdownButtonTitle>
    );

    const dropDown = (
        <DropdownButton id="aodp-sort-dropdown" title={title}>
            <DropdownItem onClick={() => onSelect("length")}>Length</DropdownItem>
            <DropdownItem onClick={() => onSelect("e")}>E-Value</DropdownItem>
            <DropdownItem onClick={() => onSelect("orfs")}>ORFs</DropdownItem>
        </DropdownButton>
    );

    return (
        <StyledAODPToolBar>
            <SearchInput onChange={handleChangeSearch} onKeyDown={e => e.stopPropagation()} placeholder="Name" />
            {dropDown}
            <Input
                type="number"
                placeholder="Minimum Identity"
                min={0.5}
                max={1.0}
                step={0.01}
                value={filterAODP.toFixed(2)}
                onChange={e => handleChangeFilter(e)}
            />
        </StyledAODPToolBar>
    );
};

const mapStateToProps = state => ({
    filterAODP: state.analyses.filterAODP,
    fuse: getFuse(state),
    id: state.analyses.detail.id,
    sortKey: state.analyses.sortKey
});

const mapDispatchToProps = dispatch => ({
    onSearch: (term, fuse) => {
        dispatch(setSearchIds(term ? fuse.search(term) : null));
    },

    onSelect: sortKey => {
        dispatch(setAnalysisSortKey(sortKey));
    },

    onSetFilter: identity => {
        dispatch(setAODPFilter(identity));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(AODPToolBar);
