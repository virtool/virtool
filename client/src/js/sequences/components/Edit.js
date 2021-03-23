import React from "react";
import { connect } from "react-redux";
import { getDataType } from "../../references/selectors";
import { routerLocationHasState } from "../../utils/utils";
import EditBarcodeSequence from "./Barcode/Edit";
import EditGenomeSequence from "./Genome/Edit";

export const EditSequence = ({ dataType }) =>
    dataType === "barcode" ? <EditBarcodeSequence /> : <EditGenomeSequence />;

export const mapStateToProps = state => ({
    dataType: getDataType(state),
    show: routerLocationHasState(state, "editSequence")
});

export default connect(mapStateToProps)(EditSequence);
