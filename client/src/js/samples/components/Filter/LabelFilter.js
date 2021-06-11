import { xor } from "lodash-es";
import React, { useState } from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { updateSearch } from "../../actions";
import { getLabelsFromURL } from "../../selectors";
import { LabelFilterItem } from "./LabelFilterItem";

const StyledLabelFilter = styled.div`
    display: flex;
    flex-wrap: wrap;
`;

export const LabelFilter = ({ initialLabels, labels, onFind }) => {
    const [selected, setSelected] = useState(initialLabels);

    const handleClick = id => {
        setSelected(selected => xor(selected, [id]));
        onFind(xor(selected, [id]));
    };

    const labelComponents = labels.map(label => (
        <LabelFilterItem key={label.id} {...label} pressed={selected.includes(label.id)} onClick={handleClick} />
    ));

    return <StyledLabelFilter>{labelComponents}</StyledLabelFilter>;
};

export const mapStateToProps = state => ({
    initialLabels: getLabelsFromURL(state),
    labels: state.labels.documents
});

export const mapDispatchToProps = dispatch => ({
    onFind: labels => {
        dispatch(updateSearch({ labels }));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(LabelFilter);
