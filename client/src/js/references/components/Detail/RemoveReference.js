import React from "react";
import { connect } from "react-redux";
import { Button, Alert } from "../../../base";
import { removeReference } from "../../actions";

const RemoveReference = ({ id, onConfirm }) => (
    <Alert bsStyle="danger">
        <div style={{ textAlign: "right" }}>
            <span style={{ float: "left", marginTop: "7px" }}>
                Click the Delete button to permanently remove this reference.
            </span>
            <Button bsStyle="danger" onClick={() => onConfirm(id)}>
                Delete
            </Button>
        </div>
    </Alert>
);

const mapDispatchToProps = (dispatch) => ({

    onConfirm: (refId) => {
        dispatch(removeReference(refId));
    }

});

export default connect(null, mapDispatchToProps)(RemoveReference);
