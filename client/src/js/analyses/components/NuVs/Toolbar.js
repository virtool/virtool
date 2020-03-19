import React, { useCallback } from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { Button, DropdownButton, DropdownItem, Icon, LinkButton, SearchInput, Toolbar } from "../../../base";
import { setAnalysisSortKey, setSearchIds, toggleFilterORFs, toggleFilterSequences } from "../../actions";
import { getFuse, getResults } from "../../selectors";

const StyledNuVsToolbar = styled(Toolbar)`
    margin-bottom: 10px;
`;

const sortTitles = {
    coverage: "Coverage",
    depth: "Depth",
    e: "E-Value",
    length: "Length",
    orfs: "ORFs",
    weight: "Weight"
};

const StyledSortDropdownButtonTitle = styled.div`
    align-items: center;
    display: flex;
    width: 106px;

    i {
        margin-left: auto;
    }
`;

const SortDropdownButtonTitle = ({ sortKey }) => (
    <StyledSortDropdownButtonTitle>
        <span>
            <Icon name="sort" /> Sort: {sortTitles[sortKey]}
        </span>
        <Icon name="caret-down" />
    </StyledSortDropdownButtonTitle>
);

const SortDropdownButton = ({ sortKey, onSelect }) => (
    <DropdownButton id="nuvs-sort-dropdown" title={<SortDropdownButtonTitle sortKey={sortKey} />}>
        <DropdownItem onClick={() => onSelect("length")}>Length</DropdownItem>
        <DropdownItem onClick={() => onSelect("e")}>E-Value</DropdownItem>
        <DropdownItem onClick={() => onSelect("orfs")}>ORFs</DropdownItem>
    </DropdownButton>
);

const NuVsToolbar = ({
    filterORFs,
    filterSequences,
    fuse,
    id,
    sortKey,
    onFilterSequences,
    onFilterORFs,
    onSearch,
    onSelect
}) => {
    const handleChange = useCallback(
        e => {
            onSearch(e.target.value, fuse);
        },
        [id]
    );

    return (
        <StyledNuVsToolbar>
            <SearchInput onChange={handleChange} onKeyDown={e => e.stopPropagation()} placeholder="Name or family" />
            <SortDropdownButton sortKey={sortKey} onSelect={onSelect} />
            <Button
                icon="filter"
                onClick={onFilterSequences}
                active={filterSequences}
                tip="Hide sequences that have no HMM hits"
            >
                Filter Sequences
            </Button>
            <Button icon="filter" onClick={onFilterORFs} active={filterORFs} tip="Hide ORFs that have no HMM hits">
                Filter ORFs
            </Button>
            <LinkButton to={{ state: { export: true } }} tip="Export">
                Export
            </LinkButton>
        </StyledNuVsToolbar>
    );
};

const mapStateToProps = state => {
    const { detail, filterORFs, filterSequences, sortKey } = state.analyses;
    return {
        id: detail.id,
        fuse: getFuse(state),
        results: getResults(state),
        filterORFs,
        filterSequences,
        sortKey
    };
};

const mapDispatchToProps = dispatch => ({
    onFilterSequences: () => {
        dispatch(toggleFilterSequences());
    },
    onFilterORFs: () => {
        dispatch(toggleFilterORFs());
    },
    onSearch: (term, fuse) => {
        dispatch(setSearchIds(term ? fuse.search(term) : null));
    },
    onSelect: sortKey => {
        dispatch(setAnalysisSortKey(sortKey));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(NuVsToolbar);
