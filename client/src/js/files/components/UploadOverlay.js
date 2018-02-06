import React from "react";
import CX from "classnames";
import PropTypes from "prop-types";
import { map, sortBy } from "lodash-es";
import { Badge, ListGroup } from "react-bootstrap";
import { connect } from "react-redux";

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

class UploadOverlay extends React.Component {

    componentWillReceiveProps (nextProps) {
        if (nextProps.uploadsComplete !== this.props.uploadsComplete && nextProps.uploadsComplete) {
            window.removeEventListener("beforeunload", this.handlePageLeave);
        } else if (nextProps.uploadsComplete !== this.props.uploadsComplete && !nextProps.uploadsComplete) {
            window.addEventListener("beforeunload", this.handlePageLeave);
        }
    }

    handlePageLeave = (e) => {
        const message = "Upload(s) still in progress";
        e.returnValue = message;
        return message;
    };

    render () {

        const classNames = CX("upload-overlay", {hidden: !this.props.showUploadOverlay});
        const uploadComponents = map(sortBy(this.props.uploads, "progress").reverse(), upload =>
            upload.progress === 100 ? <div key={upload.localId} /> : <UploadItem key={upload.localId} {...upload} />
        );

        const content = this.props.uploadsComplete ? null : (
            <div className={classNames}>
                <div className="upload-overlay-content">
                    <h5>
                        <span>
                            <strong>Uploads</strong> <Badge>{uploadComponents.length}</Badge>
                        </span>
                        <button type="button" className="close pullRight" onClick={this.props.onClose}>
                            <span>&times;</span>
                        </button>
                    </h5>
                    <ListGroup style={{height: "auto", maxHeight: "175px", overflowX: "hidden"}}>
                        {uploadComponents}
                    </ListGroup>
                </div>
            </div>
        );
    }
}

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
