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

'use strict';

var React = require("react");
var Modal = require("react-bootstrap/lib/Modal");
var Button = require("react-bootstrap/lib/Button");
var ButtonToolbar = require("react-bootstrap/lib/ButtonToolbar");

var Icon = require('virtool/js/components/Base/Icon.jsx');

/**
 * A base modal that displays detailed information for a collection document. Virtool displays documents in tables in a
 * reduced form. When the application needs more detailed information for an document, a request is sent to the server and
 * the returned detail object can be rendered into the modal component returned by this module.
 */
var DetailModal = React.createClass({

    propTypes: {
        onHide: React.PropTypes.func.isRequired, // Function to call when the modal needs to hide (eg. click close).
        collection: React.PropTypes.object.isRequired,
        contentComponent: React.PropTypes.func.isRequired,
        target: React.PropTypes.object,
        bsSize: React.PropTypes.string
    },

    getDefaultProps: function () {
        return {bsSize: 'large'};
    },

    getInitialState: function () {
        return {
            pending: true,
            data: null
        };
    },

    componentWillUnmount: function () {
        this.props.collection.off('change', this.tryRefresh);
    },

    handleEntered: function () {
        // Request detail for the document from the server. The data will be returned in a transaction. Pass the data
        // to a callback that will update the contentComponent.
        this.props.collection.request('detail', {_id: this.props.target._id}, this.receivedDetail);

        // Listen for changes to the collection that the detail belongs to. If a change occurs in the document currently
        // displayed in the detail modal, get updated detail from the server and re-render the detail component.
        this.props.collection.on('change', this.tryRefresh);
    },

    handleExit: function () {
        this.props.collection.off('change', this.tryRefresh);
    },

    handleExited: function () {
        this.setState({
            pending: true,
            data: null
        });
    },

    receivedDetail: function (data) {
        this.setState({
            pending: false,
            data: data
        });
    },

    tryRefresh: function () {

        var document = this.props.collection.find({_id: this.props.target._id});

        if (document && this.state.data._version !== document._version) {
            this.props.collection.request('detail', {_id: this.props.target._id}, this.receivedDetail);
        }

        if (!document) this.props.onHide();
    },

    render: function () {
        
        var modalContent;
        var show = Boolean(this.props.target);
        
        if (!this.state.pending) {
            var ContentComponent = this.props.contentComponent;
            modalContent = <ContentComponent key='main' detail={_.cloneDeep(this.state.data)} {...this.props} />;
        } else {
            var loadingStyle = {
                marginTop: '35px',
                marginBottom: '35px'
            };

            modalContent = (
                <Modal.Body key='loading' style={loadingStyle}>
                    <div className="text-center">
                        <p>Loading</p>
                        <div className="spinning">
                            <Icon name='spinner' pending={true} />
                        </div>
                    </div>
                </Modal.Body>
            );
        }

        var modalProps = {
            show: show,
            onEntered: this.handleEntered,
            onExit: this.handleExit,
            onExited: this.handleExited
        };

        return (
            <Modal {...modalProps} {...this.props}>
                {modalContent}
            </Modal>
        );

    }
});

module.exports = DetailModal;