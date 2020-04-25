import { filter, map, values } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { pushState } from "../../app/actions";
import {
    Attribution,
    BoxGroup,
    BoxGroupSection,
    Button,
    ModalBody,
    ModalFooter,
    Input,
    InputError,
    InputGroup,
    InputLabel,
    Modal,
    NoneFoundSection,
    ModalHeader
} from "../../base";

import { findFiles } from "../../files/actions";
import { getTargetChange, routerLocationHasState } from "../../utils/utils";
import { createSubtraction } from "../actions";

const StyledSubtractionFileItem = styled(BoxGroupSection)`
    display: flex;

    ${Attribution} {
        margin-left: auto;
    }
`;

export class SubtractionFileItem extends React.Component {
    handleClick = () => {
        this.props.onClick(this.props.id);
    };

    render() {
        const { active, name, uploaded_at, user } = this.props;

        return (
            <StyledSubtractionFileItem active={active} onClick={this.handleClick}>
                <strong>{name}</strong>
                <Attribution user={user.id} time={uploaded_at} />
            </StyledSubtractionFileItem>
        );
    }
}

const SubtractionFileList = styled(BoxGroup)`
    margin-bottom: 5px;
`;

const getInitialState = () => ({
    errorName: "",
    errorFile: "",
    fileId: "",
    name: "",
    nickname: ""
});

export class CreateSubtraction extends React.Component {
    constructor(props) {
        super(props);
        this.state = getInitialState();
    }

    handleChange = e => {
        const { name, value, error } = getTargetChange(e.target);
        this.setState({ [name]: value, [error]: "" });
    };

    handleModalEnter = () => {
        this.props.onListFiles();
    };

    handleModalExited = () => {
        this.setState(getInitialState());
    };

    handleSelectFile = fileId => {
        this.setState({
            fileId: fileId === this.state.fileId ? "" : fileId,
            errorFile: ""
        });
    };

    handleSubmit = e => {
        e.preventDefault();

        const update = {};

        if (!this.state.name) {
            update.errorName = "A name is required";
        }

        if (!this.state.fileId) {
            update.errorFile = "Please select a file";
        }

        if (values(update).length) {
            return this.setState(update);
        }

        this.props.onCreate(this.state);
    };

    render() {
        let fileComponents = map(this.props.files, file => (
            <SubtractionFileItem
                key={file.id}
                {...file}
                active={file.id === this.state.fileId}
                onClick={this.handleSelectFile}
            />
        ));

        if (!fileComponents.length) {
            fileComponents = (
                <NoneFoundSection noun="files">
                    <Link to="/subtraction/files">Upload some</Link>
                </NoneFoundSection>
            );
        }

        return (
            <Modal
                label="Create Subtraction"
                show={this.props.show}
                onHide={this.props.onHide}
                onEnter={this.handleModalEnter}
                onExited={this.handleModalExited}
            >
                <ModalHeader>Create Subtraction</ModalHeader>
                <form onSubmit={this.handleSubmit}>
                    <ModalBody>
                        <InputGroup>
                            <InputLabel>Name</InputLabel>
                            <Input name="name" value={this.state.name} onChange={this.handleChange} />
                            <InputError>{this.state.errorName}</InputError>
                        </InputGroup>

                        <InputGroup>
                            <InputLabel>Nickname</InputLabel>
                            <Input name="nickname" value={this.state.nickname} onChange={this.handleChange} />
                        </InputGroup>

                        <label>Files</label>
                        <SubtractionFileList>{fileComponents}</SubtractionFileList>
                        <InputError>{this.state.errorFile}</InputError>
                    </ModalBody>

                    <ModalFooter>
                        <Button type="submit" color="blue" icon="play">
                            Start
                        </Button>
                    </ModalFooter>
                </form>
            </Modal>
        );
    }
}

const mapStateToProps = state => ({
    show: routerLocationHasState(state, "createSubtraction"),
    files: filter(state.files.documents, { type: "subtraction" })
});

const mapDispatchToProps = dispatch => ({
    onCreate: ({ fileId, name, nickname }) => {
        dispatch(createSubtraction(fileId, name, nickname));
    },

    onListFiles: () => {
        dispatch(findFiles("subtraction"));
    },

    onHide: () => {
        dispatch(pushState({ createSubtraction: false }));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(CreateSubtraction);
