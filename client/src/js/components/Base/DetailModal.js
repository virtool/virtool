/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports DetailModal
 */

import React from "react";
import { cloneDeep } from "lodash-es";
import { Pulse, Modal } from "./";

/**
 * A base modal that displays detailed information for a collection document. Virtool displays documents in tables in a
 * reduced form. When the application needs more detailed information for an document, a request is sent to the serve
 * and the returned detail object can be rendered into the modal component returned by this module.
 */
export default class DetailModal extends React.Component {

    constructor (props) {
        super(props);

        this.state = {
            pending: true,
            data: null
        };
    }

    static propTypes = {
        onHide: React.PropTypes.func.isRequired, // Function to call when the modal needs to hide (eg. click close).
        collection: React.PropTypes.object.isRequired,
        contentComponent: React.PropTypes.func.isRequired,
        target: React.PropTypes.object,
        bsSize: React.PropTypes.string
    };

    static defaultProps = {
        bsSize: "large"
    };

    componentWillUnmount () {
        this.props.collection.off("change", this.tryRefresh);
    }

    modalEntered = () => {
        // Request detail for the document from the server. The data will be returned in a transaction. Pass the data
        // to a callback that will update the contentComponent.
        this.props.collection.request("detail", {_id: this.props.target._id}).success(function (data) {
            this.setState({
                pending: false,
                data: data
            });
        }, this);

        // Listen for changes to the collection that the detail belongs to. If a change occurs in the document currently
        // displayed in the detail modal, get updated detail from the server and re-render the detail component.
        this.props.collection.on("change", this.tryRefresh);
    };

    modalWillExit = () => {
        this.props.collection.off("change", this.tryRefresh);
    };

    modalExited = () => {
        this.setState({
            pending: true,
            data: null
        });
    };

    handleResize = () => {
        this.refs.modal.updateStyle();
    };

    tryRefresh = () => {

        const document = this.props.collection.find({_id: this.props.target._id});

        if (document && this.state.data._version !== document._version) {
            this.props.collection.request("detail", {_id: this.props.target._id}).success((data) => {
                this.setState({
                    pending: false,
                    data: data
                });
            });
        }

        if (!document) {
            this.props.onHide();
        }
    };

    render () {

        const show = Boolean(this.props.target);

        let modalContent;
        
        if (!this.state.pending) {
            modalContent = (
                <this.props.contentComponent
                    key="main"
                    detail={cloneDeep(this.state.data)}
                    updateStyle={this.handleResize}
                    {...this.props}
                />
            );
        } else {
            const loadingStyle = {
                marginTop: "35px",
                marginBottom: "35px"
            };

            modalContent = (
                <Modal.Body key="loading" style={loadingStyle}>
                    <div className="text-center">
                        <Pulse bsStyle="primary" />
                    </div>
                </Modal.Body>
            );
        }

        const modalProps = {
            show: show,
            bsSize: this.props.bsSize,
            onHide: this.props.onHide,
            onEntered: this.modalEntered,
            onExit: this.modalWillExit,
            onExited: this.modalExited
        };

        return (
            <Modal ref="modal" {...modalProps}>
                {modalContent}
            </Modal>
        );

    }
}
