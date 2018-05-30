import React from "react";
import { Modal } from "react-bootstrap";
import { map } from "lodash-es";
import { Button, NoneFound } from "../../../base";

import MemberEntry from "./MemberEntry";

const getInitialState = () => ({
    selected: "",
    id: "",
    build: false,
    modify: false,
    modify_otu: false,
    remove: false
});

export default class AddReferenceMember extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    handleChange = (id, key, value) => {
        this.setState({
            id,
            [key]: value
        });
    }

    handleSubmit = () => {
        if (!this.state.id.length) {
            return;
        }

        this.props.onAdd({...this.state});
    }

    handleExited = () => {
        this.props.onHide();
        this.setState(getInitialState());
    }

    toggleMember = (member) => {
        if (this.state.selected !== member || !this.state.selected) {
            this.setState({ ...getInitialState(), selected: member });
        } else {
            this.setState(getInitialState());
        }
    };

    render () {

        const listComponents = this.props.list.length
            ? map(this.props.list, member =>
                <MemberEntry
                    key={member.id}
                    onEdit={this.handleChange}
                    onToggleSelect={this.toggleMember}
                    add={this.state.selected === member.id}
                    id={member.id}
                    identicon={member.identicon}
                    permissions={this.state.selected === member.id
                        ? {
                            build: this.state.build,
                            modify: this.state.modify,
                            modify_otu: this.state.modify_otu,
                            remove: this.state.remove
                        }
                        : {
                            build: member.build,
                            modify: member.modify,
                            modify_otu: member.modify_otu,
                            remove: member.remove
                        }}
                    isSelected={this.state.selected === member.id}
                />)
            : <NoneFound noun="members" />;

        return (
            <Modal show={this.props.show} onHide={this.handleExited} onExit={this.handleExited}>
                <Modal.Header closeButton>
                    Add Member
                </Modal.Header>
                <Modal.Body style={{height: "300px", overflowY: "auto"}}>
                    {listComponents}
                </Modal.Body>
                <Modal.Footer>
                    <Button bsStyle="primary" onClick={this.handleSubmit} >
                        Add
                    </Button>
                </Modal.Footer>
            </Modal>
        );
    }
}
