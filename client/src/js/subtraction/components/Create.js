import { filter, get, map } from "lodash-es";
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
    DialogBody,
    DialogFooter,
    Input,
    InputError,
    InputGroup,
    InputLabel,
    ModalDialog,
    NoneFoundSection
} from "../../base";
import { clearError } from "../../errors/actions";

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
    fileId: "",
    nickname: "",
    subtractionId: "",
    errorFile: "",
    errorSubtractionId: ""
});

export class CreateSubtraction extends React.Component {
    constructor(props) {
        super(props);
        this.state = getInitialState();
    }

    handleChange = e => {
        const { name, value, error } = getTargetChange(e.target);

        this.setState({ [name]: value, [error]: "" });

        if (this.props.error) {
            this.props.onClearError();
        }
    };

    handleModalEnter = () => {
        this.props.onListFiles();
    };

    handleModalExited = () => {
        this.setState(getInitialState());

        if (this.props.error) {
            this.props.onClearError();
        }
    };

    handleSelectFile = fileId => {
        this.setState({
            fileId: fileId === this.state.fileId ? "" : fileId,
            errorFile: ""
        });
    };

    handleSubmit = e => {
        e.preventDefault();

        let hasError = false;

        if (!this.state.subtractionId) {
            hasError = true;
            this.setState({ errorSubtractionId: "Required Field" });
        }

        if (!this.state.fileId) {
            hasError = true;
            this.setState({ errorFile: "Please select a file" });
        }

        if (!hasError) {
            this.props.onCreate(this.state);
        }
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

        const errorSubtractionId = this.state.errorSubtractionId || this.props.error;

        return (
            <ModalDialog
                label="SubtractionCreate"
                headerText="Create Subtraction"
                show={this.props.show}
                onHide={this.props.onHide}
                onEnter={this.handleModalEnter}
                onExited={this.handleModalExited}
            >
                <form onSubmit={this.handleSubmit}>
                    <DialogBody>
                        <InputGroup>
                            <InputLabel>Unique Name</InputLabel>
                            <Input
                                error={this.state.errorSubtractionId}
                                name="subtractionId"
                                value={this.state.subtractionId}
                                onChange={this.handleChange}
                            />
                            <InputError>{errorSubtractionId}</InputError>
                        </InputGroup>

                        <InputGroup>
                            <InputLabel>Nickname</InputLabel>
                            <Input name="nickname" value={this.state.nickname} onChange={this.handleChange} />
                        </InputGroup>

                        <h5>
                            <strong>Files</strong>
                        </h5>
                        <SubtractionFileList>{fileComponents}</SubtractionFileList>
                        <InputError>{this.state.errorFile}</InputError>
                    </DialogBody>

                    <DialogFooter className="modal-footer">
                        <Button type="submit" color="blue" icon="play">
                            Start
                        </Button>
                    </DialogFooter>
                </form>
            </ModalDialog>
        );
    }
}

const mapStateToProps = state => ({
    show: routerLocationHasState(state, "createSubtraction"),
    files: filter(state.files.documents, { type: "subtraction" }),
    error: get(state, "errors.CREATE_SUBTRACTION_ERROR.message", "")
});

const mapDispatchToProps = dispatch => ({
    onCreate: ({ subtractionId, fileId, nickname }) => {
        dispatch(createSubtraction(subtractionId, fileId, nickname));
    },

    onListFiles: () => {
        dispatch(findFiles("subtraction"));
    },

    onHide: () => {
        dispatch(pushState({ createSubtraction: false }));
    },

    onClearError: () => {
        dispatch(clearError("CREATE_SUBTRACTION_ERROR"));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(CreateSubtraction);
