import { xor } from "lodash-es";
import React, { useState } from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { findSamples } from "../../actions";
import { getLabelsFromURL } from "../../selectors";
import { LabelFilterItem } from "./LabelFilterItem";

const StyledLabelFilter = styled.div`
    > *:not(:last-child) {
        margin-right: 5px;
    }
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
        dispatch(findSamples({ labels }));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(LabelFilter);
