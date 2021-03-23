import React from "react";
import { connect } from "react-redux";
import { getDataType } from "../../references/selectors";
import { routerLocationHasState } from "../../utils/utils";
import AddBarcodeSequence from "./Barcode/Add";
import AddGenomeSequence from "./Genome/Add";

export const AddSequence = ({ dataType, show }) => {
    if (dataType === "barcode") {
        return <AddBarcodeSequence show={show} />;
    }

    return <AddGenomeSequence show={show} />;
};

export const mapStateToProps = state => ({
    dataType: getDataType(state),
    show: routerLocationHasState(state, "addSequence")
});

export default connect(mapStateToProps)(AddSequence);
