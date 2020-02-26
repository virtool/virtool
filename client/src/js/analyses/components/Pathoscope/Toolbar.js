import React from "react";
import { FormControl, FormGroup, InputGroup } from "react-bootstrap";
import { connect } from "react-redux";
import styled from "styled-components";
import { Button, DropdownButton, DropdownItem, Icon, Toolbar } from "../../../base";
import {
    collapseAnalysis,
    setAnalysisSortKey,
    setPathoscopeFilter,
    togglePathoscopeSortDescending,
    toggleShowPathoscopeReads
} from "../../actions";

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
    analysisId,
    filterIsolates,
    filterOTUs,
    showReads,
    sortDescending,
    sortKey,
    onCollapse,
    onFilter,
    onSetSortKey,
    onToggleShowReads,
    onToggleSortDescending
}) => {
    return (
        <StyledPathoscopeToolbar>
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
                icon="compress"
                title="Collapse"
                tip="Collapse"
                onClick={onCollapse}
                className="hidden-xs"
                disabled={false}
            />

            <Button
                icon="chart-pie"
                title="Weight Format"
                tip="Weight Format"
                active={!showReads}
                className="hidden-xs"
                onClick={onToggleShowReads}
            />

            <Button
                active={filterOTUs}
                icon="filter"
                tip="Hide OTUs with low coverage support"
                onClick={() => onFilter("OTUs")}
            >
                Filter OTUs
            </Button>

            <Button
                active={filterIsolates}
                icon="filter"
                tip="Hide isolates with low coverage support"
                onClick={() => onFilter("isolates")}
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
    const { filterIsolates, filterOTUs, showReads, sortDescending, sortKey } = state.analyses;
    return {
        analysisId: state.analyses.detail.id,
        filterIsolates,
        filterOTUs,
        showReads,
        sortDescending,
        sortKey
    };
};

export const mapDispatchToProps = dispatch => ({
    onCollapse: () => {
        dispatch(collapseAnalysis());
    },

    onFilter: key => {
        if (key !== "OTUs" && key !== "isolates") {
            key = "";
        }

        dispatch(setPathoscopeFilter(key));
    },

    onSetSortKey: key => {
        dispatch(setAnalysisSortKey(key));
    },

    onToggleSortDescending: () => {
        dispatch(togglePathoscopeSortDescending());
    },

    onToggleShowReads: () => {
        dispatch(toggleShowPathoscopeReads());
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(PathoscopeToolbar);
