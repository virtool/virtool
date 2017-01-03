import React from "react";
import { assign } from "lodash-es";
import { Modal } from "react-bootstrap";
import { Icon } from "virtool/js/components/Base";
import SequenceForm from "virtool/js/components/Viruses/Manage/Detail/Sequences/Form";

export const changesPropTypes = {
    changes: React.PropTypes.array
};

export const annotationPropTypes = {
    annotation: React.PropTypes.object
};

export const bothPropTypes = assign({}, changesPropTypes, annotationPropTypes);

export const MethodBase = (props) => (
    <span>
        <Icon name={props.iconName} bsStyle={props.bsStyle} />
        <span> {props.verb} virus <em>{props.changes.name} ({props.changes._id})</em></span>
    </span>
);

MethodBase.propTypes = assign({
    verb: React.PropTypes.string,
    iconName: React.PropTypes.string,
    bsStyle: React.PropTypes.string
}, changesPropTypes);

export const SequenceReader = ({sequence}) => (
    <SequenceForm
        sequenceId={sequence._id}
        definition={sequence.definition}
        host={sequence.host}
        sequence={sequence.sequence}
        readOnly={true}
    />
);

SequenceReader.propTypes = {
    sequence: React.PropTypes.object
};

export class MethodWithModal extends React.Component {

    constructor (props) {
        super(props);
        this.state = {
            show: false
        };
    }

    static propTypes = {
        children: React.PropTypes.element,
        message: React.PropTypes.oneOf([React.PropTypes.element, React.PropTypes.string])
    };

    shouldComponentUpdate (nextProps, nextState) {
        return this.state.show !== nextState.show;
    }

    showModal = () => {
        this.setState({
            show: true
        });
    };

    hideModal = () => {
        this.setState({
            show: false
        });
    };

    render () {
        return (
            <span>
                {this.props.message} <Icon name="question" bsStyle="info" onClick={this.showModal} />

                <Modal show={this.state.show} onHide={this.hideModal} >
                    <Modal.Header>
                        <Modal.Title>
                            {this.props.message}
                        </Modal.Title>
                    </Modal.Header>

                    <Modal.Body>
                        {this.props.children}
                    </Modal.Body>
                </Modal>
            </span>
        );
    }
}
