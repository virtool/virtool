import { xor } from "lodash-es";
import React, { useState } from "react";
import { connect } from "react-redux";
import { updateSearch } from "../../actions";
import { getLabelsFromURL } from "../../selectors";
import { LabelFilterItem } from "./LabelFilterItem";
import { SidebarHeader, SideBarSection } from "../../../base";
import { Link } from "react-router-dom";

export const LabelFilter = ({ initialLabels, labels, onFind }) => {
    const [selected, setSelected] = useState(initialLabels);

    const handleClick = id => {
        setSelected(selected => xor(selected, [id]));
        onFind(xor(selected, [id]));
    };

    const labelComponents = labels.map(label => (
        <LabelFilterItem key={label.id} {...label} pressed={selected.includes(label.id)} onClick={handleClick} />
    ));

    return (
        <SideBarSection>
            <SidebarHeader>
                Labels <Link to="/samples/labels">Manage</Link>
            </SidebarHeader>
            {labelComponents}
        </SideBarSection>
    );
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
