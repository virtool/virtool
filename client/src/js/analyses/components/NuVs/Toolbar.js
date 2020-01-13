import React, { useCallback } from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { DropdownButton, FormControl, FormGroup, InputGroup, MenuItem } from "react-bootstrap";
import { LinkContainer } from "react-router-bootstrap";
import { Button, Icon, Toolbar } from "../../../base";
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

const SortDropdownButtonTitle = ({ sortKey }) => (
    <span>
        <span>
            <Icon name="sort" /> Sort:{" "}
        </span>
        <span>{sortTitles[sortKey]}</span>
    </span>
);

const StyledSortDropdownButton = styled(DropdownButton)`
    align-items: center;
    display: flex;
    justify-content: space-between;
    width: 132px;
`;

const SortDropdownButton = ({ sortKey, onSelect }) => (
    <StyledSortDropdownButton
        id="nuvs-sort-dropdown"
        key={sortKey}
        title={<SortDropdownButtonTitle sortKey={sortKey} />}
        onSelect={onSelect}
    >
        <MenuItem eventKey="length">Length</MenuItem>
        <MenuItem eventKey="e">E-Value</MenuItem>
        <MenuItem eventKey="orfs">ORFs</MenuItem>
    </StyledSortDropdownButton>
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
            <FormGroup>
                <InputGroup>
                    <InputGroup.Addon>
                        <Icon name="search" />
                    </InputGroup.Addon>
                    <FormControl
                        onChange={handleChange}
                        onKeyDown={e => e.stopPropagation()}
                        placeholder="Name or family"
                    />
                </InputGroup>
            </FormGroup>
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
            <LinkContainer to={{ state: { export: true } }}>
                <Button tip="Export" icon="download" />
            </LinkContainer>
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
