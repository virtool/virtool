import { toNumber } from "lodash-es";
import React, { useCallback } from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { Input, SearchInput } from "../../../base";
import { setAODPFilter, setSearchIds } from "../../actions";
import { getFuse } from "../../selectors";

const StyledAODPToolBar = styled.div`
    display: grid;
    grid-template-columns: 3fr 1fr;
    grid-gap: 5px;
`;

export const AODPToolBar = ({ filterAODP, fuse, id, onSearch, onSetFilter }) => {
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
        <StyledAODPToolBar>
            <SearchInput onChange={handleChangeSearch} onKeyDown={e => e.stopPropagation()} placeholder="Name" />
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
    id: state.analyses.detail.id
});

const mapDispatchToProps = dispatch => ({
    onSearch: (term, fuse) => {
        dispatch(setSearchIds(term ? fuse.search(term) : null));
    },

    onSetFilter: identity => {
        dispatch(setAODPFilter(identity));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(AODPToolBar);
