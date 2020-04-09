import { toNumber } from "lodash-es";
import React, { useCallback } from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { Input, SearchInput, Toolbar } from "../../../base";
import { setAnalysisSortKey, setAODPFilter, setSearchIds } from "../../actions";
import { getFuse } from "../../selectors";
import { AnalysisViewerSort } from "../Viewer/Sort";

const StyledAODPToolbar = styled(Toolbar)`
    input[type="number"] {
        max-width: 130px;
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

    return (
        <StyledAODPToolbar>
            <SearchInput onChange={handleChangeSearch} onKeyDown={e => e.stopPropagation()} placeholder="Name" />
            <AnalysisViewerSort algorithm="aodp" sortKey={sortKey} onSelect={onSelect} />
            <Input
                type="number"
                placeholder="Minimum Identity"
                min={0.5}
                max={1.0}
                step={0.01}
                value={filterAODP.toFixed(2)}
                onChange={e => handleChangeFilter(e)}
            />
        </StyledAODPToolbar>
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
