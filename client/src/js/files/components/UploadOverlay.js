import CX from "classnames";
import { sortBy } from "lodash-es";
import React from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { Badge, ListGroup } from "react-bootstrap";

import { byteSize } from "../../utils";
import { hideUploadOverlay } from "../actions";
import { Flex, FlexItem, ListGroupItem, ProgressBar } from "../../base";

const UploadItem = ({ localId, name, progress, size}) => (
    <ListGroupItem key={localId} disabled={progress === 0}>
        <ProgressBar bsStyle={progress === 100 ? "primary" : "success"} now={progress} affixed />
        <Flex>
            <FlexItem grow={1}>
                {name}
            </FlexItem>
            <FlexItem shrink={0} grow={0} pad={15}>
                {byteSize(size)}
            </FlexItem>
        </Flex>
    </ListGroupItem>
);

const UploadOverlay = (props) => {

    const classNames = CX("upload-overlay", {hidden: !props.showUploadOverlay});

    const uploadComponents = sortBy(props.uploads, "progress").reverse().map(upload =>
        <UploadItem key={upload.localId} {...upload} />
    );

    return (
        <div className={classNames}>
            <div className="upload-overlay-content">
                <h5>
                    <span>
                        <strong>Uploads</strong> <Badge>{uploadComponents.length}</Badge>
                    </span>
                    <button type="button" className="close pullRight" onClick={props.onClose}>
                        <span>&times;</span>
                    </button>
                </h5>
                <ListGroup>
                    {uploadComponents}
                </ListGroup>
            </div>
        </div>
    );
};

UploadOverlay.propTypes = {
    uploads: PropTypes.arrayOf(PropTypes.object),
    showUploadOverlay: PropTypes.bool,
    uploadsComplete: PropTypes.bool,
    onClose: PropTypes.func
};

const mapStateToProps = (state) => ({...state.files});

const mapDispatchToProps = (dispatch) => ({

    onClose: () => {
        dispatch(hideUploadOverlay());
    }

});

const Container = connect(mapStateToProps, mapDispatchToProps)(UploadOverlay);

export default Container;
