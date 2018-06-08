import React from "react";
import CX from "classnames";
import PropTypes from "prop-types";
import { reduce, sortBy } from "lodash-es";
import { Badge, ListGroup } from "react-bootstrap";
import { connect } from "react-redux";

import { byteSize } from "../../utils";
import { hideUploadOverlay } from "../actions";
import { Flex, FlexItem, ListGroupItem, ProgressBar } from "../../base";

const UploadItem = ({ localId, name, progress, size}) => (
    <ListGroupItem key={localId}>
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

    const uploadComponents = reduce(sortBy(props.uploads, "progress").reverse(), (result, upload) => {
        if (upload.fileType !== "reference" && upload.progress !== 100) {
            result.push(<UploadItem key={upload.localId} {...upload} />);
        }
        return result;
    }, []);

    const content = (props.uploadsComplete || !uploadComponents.length) ? null : (
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
                <ListGroup style={{height: "auto", maxHeight: "175px", overflowX: "hidden"}}>
                    {uploadComponents}
                </ListGroup>
            </div>
        </div>
    );

    return <div>{content}</div>;
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

export default connect(mapStateToProps, mapDispatchToProps)(UploadOverlay);
