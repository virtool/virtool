import CX from "classnames";
import { concat, reduce } from "lodash-es";
import PropTypes from "prop-types";
import React from "react";
import { Badge, ListGroup } from "react-bootstrap";
import { connect } from "react-redux";
import { UploadItem } from "./UploadItem";

export const UploadOverlay = props => {
    const classNames = CX("upload-overlay", { hidden: !props.showUploadOverlay });

    const pendingEntries = [];

    const loadingEntries = reduce(
        props.uploads,
        (result, upload) => {
            if (upload.progress === 100 || upload.fileType === "reference") {
                return result;
            } else if (upload.progress === 0) {
                pendingEntries.push(<UploadItem key={upload.localId} {...upload} />);
            } else {
                result.push(<UploadItem key={upload.localId} {...upload} />);
            }
            return result;
        },
        []
    );

    const uploadComponents = concat(loadingEntries, pendingEntries);

    const content =
        props.uploadsComplete || !uploadComponents.length ? null : (
            <div className={classNames}>
                <div className="upload-overlay-content">
                    <h5>
                        <span>
                            <strong>Uploads</strong> <Badge>{uploadComponents.length}</Badge>
                        </span>
                    </h5>
                    <ListGroup style={{ height: "auto", maxHeight: "175px", overflowX: "hidden" }}>
                        {uploadComponents}
                    </ListGroup>
                </div>
            </div>
        );

    return <div>{content}</div>;
};

UploadOverlay.propTypes = {
    uploads: PropTypes.arrayOf(PropTypes.object),
    uploadsComplete: PropTypes.bool,
    onClose: PropTypes.func
};

const mapStateToProps = state => ({ ...state.files });

export default connect(mapStateToProps)(UploadOverlay);
