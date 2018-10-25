import React from "react";
import { Modal } from "react-bootstrap";
import { map } from "lodash-es";
import { Button, NoneFound } from "../../../base";

import MemberEntry from "./MemberEntry";
import UserList from "./UserList";

const getInitialState = () => ({
    selected: "",
    id: "",
    build: false,
    modify: false,
    modify_otu: false,
    remove: false
});

export default class AddReferenceMember extends React.Component {
    constructor(props) {
        super(props);
        this.state = getInitialState();
    }

    handleChange = (id, key, value) => {
        this.setState({
            id,
            [key]: value
        });
    };

    handleSubmit = () => {
        if (!this.state.id.length) {
            return;
        }
        const idType = this.props.noun === "users" ? "user_id" : "group_id";
        this.props.onAdd({ ...this.state }, idType);
    };

    handleExited = () => {
        this.props.onHide();
        this.setState(getInitialState());
    };

    toggleMember = member => {
        if (this.state.selected !== member || !this.state.selected) {
            this.setState({ ...getInitialState(), selected: member });
        } else {
            this.setState(getInitialState());
        }
    };

    render() {
        const modalStyle = this.props.list.length ? { height: "300px", overflowY: "auto" } : null;
        let listComponents = <NoneFound noun={this.props.noun} style={{ margin: "0" }} />;
        let content;

        if (this.props.noun === "users") {
            content = this.props.list.length ? (
                <UserList
                    documents={this.props.list}
                    onEdit={this.handleChange}
                    onToggleSelect={this.toggleMember}
                    selected={this.state.selected}
                    permissions={{
                        build: this.state.build,
                        modify: this.state.modify,
                        modify_otu: this.state.modify_otu,
                        remove: this.state.remove
                    }}
                />
            ) : (
                <Modal.Body style={modalStyle}>{listComponents}</Modal.Body>
            );
        } else {
            listComponents = this.props.list.length
                ? map(this.props.list, member => (
                      <MemberEntry
                          key={member.id}
                          onEdit={this.handleChange}
                          onToggleSelect={this.toggleMember}
                          add={this.state.selected === member.id}
                          id={member.id}
                          identicon={member.identicon}
                          permissions={
                              this.state.selected === member.id
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
                                    }
                          }
                          isSelected={this.state.selected === member.id}
                      />
                  ))
                : listComponents;

            content = <Modal.Body style={modalStyle}>{listComponents}</Modal.Body>;
        }

        return (
            <Modal show={this.props.show} onHide={this.handleExited} onExit={this.handleExited}>
                <Modal.Header closeButton>
                    <span className="text-capitalize">Add {this.props.noun}</span>
                </Modal.Header>
                {content}
                <Modal.Footer>
                    <Button bsStyle="primary" onClick={this.handleSubmit}>
                        Add
                    </Button>
                </Modal.Footer>
            </Modal>
        );
    }
}
