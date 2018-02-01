import React from "react";
import CX from "classnames";
import PropTypes from "prop-types";
import { map, sortBy } from "lodash-es";
import { Badge, ListGroup } from "react-bootstrap";
import { connect } from "react-redux";

import { byteSize } from "../../utils";
import { hideUploadOverlay } from "../actions";
import { Flex, FlexItem, ListGroupItem, ProgressBar, Icon, Button } from "../../base";

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
                {   progress === 100 
                    ? <FlexItem pad={10}>
                        <Icon name="checkmark" tip="Done" /> 
                    </FlexItem>
                    : <div />
                }
            </Flex>
        </ListGroupItem>
);

class UploadOverlay extends React.Component {

    handlePageLeave (e) {
        const message = 'Upload(s) still in progress';   //browser security standards don't allow custom messages
        e.returnValue = message;
        return message;
    }

    render () {

        const classNames = CX("upload-overlay", {hidden: !this.props.showUploadOverlay});

        let uploadComponents = map(sortBy(this.props.uploads, "progress").reverse(), upload =>
            upload.progress === 100 ? <div key={upload.localId}/> : <UploadItem key={upload.localId} {...upload} />
        );

        let content;

        if (this.props.uploadsComplete) {
            window.removeEventListener('beforeunload', this.handlePageLeave);

            content = null;
        } else {
            window.addEventListener('beforeunload', this.handlePageLeave);

            content = (
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

        return (
            <div>
                {content}
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
    },

});

const Container = connect(mapStateToProps, mapDispatchToProps)(UploadOverlay);

export default Container;
