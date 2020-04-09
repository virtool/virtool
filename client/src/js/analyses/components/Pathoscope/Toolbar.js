import React, { useCallback } from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { Button, DropdownButton, DropdownItem, Icon, SearchInput, Select, Toolbar } from "../../../base";
import {
    setAnalysisSortKey,
    setSearchIds,
    toggleAnalysisSortDescending,
    toggleFilterIsolates,
    toggleFilterOTUs,
    toggleShowPathoscopeReads
} from "../../actions";
import { getFuse } from "../../selectors";
import { AnalysisViewerSort } from "../Viewer/Sort";

const sortTitles = {
    coverage: "Coverage",
    depth: "Depth",
    pi: "Weight"
};

export const PathoscopeDownloadDropdownTitle = () => (
    <span>
        <Icon name="file-download" /> Export <Icon name="caret-down" />
    </span>
);

const DropDownTitle = ({ sortKey }) => (
    <span>
        <Icon name="sort" />
        Sort: {sortTitles[sortKey]}
    </span>
);

const StyledPathoscopeToolbar = styled(Toolbar)`
    display: flex;
    margin-bottom: 10px !important;
`;

export const PathoscopeToolbarSelect = styled(Select)`
    width: 110px;
`;

export const PathoscopeToolbar = ({
    id,
    analysisId,
    filterIsolates,
    filterOTUs,
    fuse,
    showPathoscopeReads,
    sortDescending,
    sortKey,
    onSearch,
    onSetSortKey,
    onToggleFilterIsolates,
    onToggleFilterOTUs,
    onToggleShowPathoscopeReads,
    onToggleSortDescending
}) => {
    const handleChange = useCallback(
        e => {
            onSearch(e.target.value, fuse);
        },
        [id]
    );

    const dropdown = (
        <AnalysisViewerSort
            type="pathoscope"
            title={<DropDownTitle sortKey={sortKey} />}
            sortKey={sortKey}
            onSelect={onSetSortKey}
        ></AnalysisViewerSort>
    );

    return (
        <StyledPathoscopeToolbar>
            <SearchInput onChange={handleChange} onKeyDown={e => e.stopPropagation()} />

            {dropdown}

            <Button title="Sort Direction" onClick={onToggleSortDescending} tip="Sort List">
                <Icon name={sortDescending ? "sort-amount-down" : "sort-amount-up"} />
            </Button>

            <Button
                active={showPathoscopeReads}
                icon="weight-hanging"
                tip="Show read pseudo-counts instead of weight"
                onClick={onToggleShowPathoscopeReads}
            >
                Show Reads
            </Button>

            <Button
                active={filterOTUs}
                icon="filter"
                tip="Hide OTUs with low coverage support"
                onClick={onToggleFilterOTUs}
            >
                Filter OTUs
            </Button>

            <Button
                active={filterIsolates}
                icon="filter"
                tip="Hide isolates with low coverage support"
                onClick={onToggleFilterIsolates}
            >
                Filter Isolates
            </Button>

            <DropdownButton id="download-dropdown" title={<PathoscopeDownloadDropdownTitle />}>
                <DropdownItem href={`/download/analyses/${analysisId}.csv`}>
                    <Icon name="file-csv" /> CSV
                </DropdownItem>
                <DropdownItem href={`/download/analyses/${analysisId}.xlsx`}>
                    <Icon name="file-excel" /> Excel
                </DropdownItem>
            </DropdownButton>
        </StyledPathoscopeToolbar>
    );
};

export const mapStateToProps = state => {
    const { filterIsolates, filterOTUs, showPathoscopeReads, sortDescending, sortKey } = state.analyses;
    return {
        id: state.analyses.activeId,
        analysisId: state.analyses.detail.id,
        filterIsolates,
        filterOTUs,
        fuse: getFuse(state),
        showPathoscopeReads,
        sortDescending,
        sortKey
    };
};

export const mapDispatchToProps = dispatch => ({
    onSearch: (term, fuse) => {
        dispatch(setSearchIds(term ? fuse.search(term) : null));
    },

    onToggleFilterIsolates: () => {
        dispatch(toggleFilterIsolates());
    },

    onToggleFilterOTUs: () => {
        dispatch(toggleFilterOTUs());
    },

    onSetSortKey: key => {
        dispatch(setAnalysisSortKey(key));
    },

    onToggleShowPathoscopeReads: () => {
        dispatch(toggleShowPathoscopeReads());
    },

    onToggleSortDescending: () => {
        dispatch(toggleAnalysisSortDescending());
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(PathoscopeToolbar);
