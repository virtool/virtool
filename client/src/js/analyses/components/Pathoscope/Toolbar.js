import React, { useCallback } from "react";
import { FormControl, FormGroup, InputGroup } from "react-bootstrap";
import { connect } from "react-redux";
import styled from "styled-components";
import { Button, DropdownButton, DropdownItem, Icon, Toolbar } from "../../../base";
import {
    setAnalysisSortKey,
    setSearchIds,
    toggleAnalysisSortDescending,
    toggleFilterIsolates,
    toggleFilterOTUs
} from "../../actions";
import { getFuse } from "../../selectors";

export const PathoscopeDownloadDropdownTitle = () => (
    <span>
        <Icon name="file-download" /> Export <Icon name="caret-down" />
    </span>
);

const StyledPathoscopeToolbar = styled(Toolbar)`
    display: flex;
    margin-bottom: 10px !important;
`;

export const PathoscopeToolbar = ({
    id,
    analysisId,
    filterIsolates,
    filterOTUs,
    fuse,
    sortDescending,
    sortKey,
    onSearch,
    onSetSortKey,
    onToggleFilterIsolates,
    onToggleFilterOTUs,
    onToggleSortDescending
}) => {
    const handleChange = useCallback(
        e => {
            onSearch(e.target.value, fuse);
        },
        [id]
    );
    return (
        <StyledPathoscopeToolbar>
            <FormGroup>
                <InputGroup>
                    <InputGroup.Addon>
                        <Icon name="search" />
                    </InputGroup.Addon>
                    <FormControl onChange={handleChange} onKeyDown={e => e.stopPropagation()} />
                </InputGroup>
            </FormGroup>
            <FormGroup>
                <InputGroup>
                    <InputGroup.Button>
                        <Button title="Sort Direction" onClick={onToggleSortDescending} tip="Sort List">
                            <Icon name={sortDescending ? "sort-amount-down" : "sort-amount-up"} />
                        </Button>
                    </InputGroup.Button>
                    <FormControl componentClass="select" value={sortKey} onChange={e => onSetSortKey(e.target.value)}>
                        <option className="text-primary" value="coverage">
                            Coverage
                        </option>
                        <option className="text-success" value="pi">
                            Weight
                        </option>
                        <option className="text-danger" value="depth">
                            Depth
                        </option>
                    </FormControl>
                </InputGroup>
            </FormGroup>

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
    const { filterIsolates, filterOTUs, sortDescending, sortKey } = state.analyses;
    return {
        id: state.analyses.activeId,
        analysisId: state.analyses.detail.id,
        filterIsolates,
        filterOTUs,
        fuse: getFuse(state),
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

    onToggleSortDescending: () => {
        dispatch(toggleAnalysisSortDescending());
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(PathoscopeToolbar);
