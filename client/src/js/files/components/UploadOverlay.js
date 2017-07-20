/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */
import CX from "classnames";
import { sortBy } from "lodash";
import React, { PropTypes } from "react";
import { connect } from "react-redux";
import { Badge, ListGroup } from "react-bootstrap";

import { byteSize } from "virtool/js/utils";
import { hideUploadOverlay } from "../actions";
import { Flex, FlexItem, ListGroupItem, ProgressBar } from "virtool/js/components/Base";

const UploadOverlay = (props) => {

    const classNames = CX("upload-overlay", {
        "hidden": !props.showUploadOverlay
    });

    const uploadComponents = sortBy(props.uploads, "progress").reverse().map(upload =>
        <ListGroupItem key={upload.localId} disabled={upload.progress === 0}>
            <ProgressBar bsStyle={upload.progress === 100 ? "primary": "success"} now={upload.progress} affixed />
            <Flex>
                <FlexItem grow={1}>
                    {upload.name}
                </FlexItem>
                <FlexItem shrink={0} grow={0} pad={15}>
                    {byteSize(upload.size)}
                </FlexItem>
            </Flex>
        </ListGroupItem>
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

const mapStateToProps = (state) => {
    return {
        uploads: state.files.uploads,
        uploadsComplete: state.files.uploadsComplete,
        showUploadOverlay: state.files.showUploadOverlay
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onClose: () => {
            dispatch(hideUploadOverlay())
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(UploadOverlay);

export default Container;
