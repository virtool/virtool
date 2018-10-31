import React from "react";
import { connect } from "react-redux";
import { Modal } from "react-bootstrap";
import { find, map } from "lodash-es";
import { Button, Checkbox } from "../../../base";
import { editReferenceGroup, editReferenceUser } from "../../actions";

const getInitialState = () => ({
    build: false,
    modify: false,
    modify_otu: false,
    remove: false
});

const rights = ["modify_otu", "build", "modify", "remove"];

export class EditReferenceMember extends React.Component {
    constructor(props) {
        super(props);
        this.state = getInitialState();
    }

    handleChange = (key, value) => {
        const { modify_otu, build, modify, remove } = this.props;

        const update = {
            modify_otu,
            build,
            modify,
            remove
        };

        update[key] = value;

        this.props.onEdit(this.props.refId, this.props.show, update);
    };

    handleEnter = () => {
        const { build, modify, modify_otu, remove } = this.props;
        this.setState({
            build,
            modify,
            modify_otu,
            remove
        });
    };

    handleExited = () => {
        this.setState(getInitialState());
    };

    render() {
        const rightComponents = map(rights, right => (
            <Checkbox
                key={right}
                checked={this.props[right]}
                label={right}
                onClick={() => this.handleChange(right, !this.props[right])}
            />
        ));

        return (
            <Modal show={!!this.props.show} onHide={this.props.onHide} onExited={this.handleExited}>
                <Modal.Header onHide={this.props.onHide} closeButton>
                    Modify Rights for {this.props.id}
                </Modal.Header>
                <Modal.Body>{rightComponents}</Modal.Body>
                <Modal.Footer>
                    <Button bsStyle="primary" onClick={this.handleSubmit}>
                        Add
                    </Button>
                </Modal.Footer>
            </Modal>
        );
    }
}

const mapStateToProps = (state, ownProps) => {
    const noun = ownProps.noun;
    const members = noun === "users" ? state.references.detail.users : state.references.detail.groups;

    return {
        refId: state.references.detail.id,
        ...find(members, { id: ownProps.show })
    };
};

const mapDispatchToProps = (dispatch, ownProps) => ({
    onEdit: (refId, id, update) => {
        const actionCreator = ownProps.noun === "users" ? editReferenceUser : editReferenceGroup;
        dispatch(actionCreator(refId, id, update));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(EditReferenceMember);
