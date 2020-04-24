import { mapValues } from "lodash-es";
import React from "react";
import { CopyToClipboard } from "react-copy-to-clipboard";
import { connect } from "react-redux";
import styled from "styled-components";
import { pushState } from "../../../app/actions";

import {
    ModalBody,
    ModalFooter,
    Flex,
    FlexItem,
    Icon,
    Input,
    InputContainer,
    InputError,
    InputGroup,
    InputIcon,
    InputLabel,
    Modal,
    SaveButton,
    ModalHeader
} from "../../../base";
import { routerLocationHasState } from "../../../utils/utils";
import { clearAPIKey, createAPIKey } from "../../actions";
import CreateAPIKeyInfo from "./CreateInfo";
import APIPermissions from "./Permissions";

const CreateAPIKeyCopied = styled.p`
    color: ${props => props.theme.color.blue};
    visibility: ${props => (props.show ? "visible" : "hidden")};
`;

const CreateAPIKeyInput = styled(Input)`
    text-align: center;
`;

const StyledCreateAPIKey = styled(ModalBody)`
    display: flex;
    flex-direction: column;
    justify-content: center;
    margin-left: 90px;
    margin-right: 90px;
    text-align: center;

    strong {
        color: ${props => props.theme.color.greenDark};
        margin-bottom: 5px;
    }
`;

const StyledFlex = styled(Flex)`
    margin-top: 15px;
    margin-bottom: 10px;
`;

export const getInitialState = props => ({
    name: "",
    permissions: mapValues(props.permissions, () => false),
    submitted: false,
    copied: false,
    error: "",
    show: false
});

export class CreateAPIKey extends React.Component {
    constructor(props) {
        super(props);
        this.state = getInitialState(props);
    }

    static getDerivedStateFromProps(nextProps, prevState) {
        if (!prevState.show && nextProps.newKey) {
            return { show: true };
        }
        return null;
    }

    handleChange = e => {
        this.setState({ name: e.target.value, error: "" });
    };

    handleCopy = () => {
        this.setState({ copied: true });
    };

    handleModalExited = () => {
        this.setState(getInitialState(this.props));
    };

    handleSubmit = e => {
        e.preventDefault();

        const { name, permissions } = this.state;

        if (!this.state.name) {
            return this.setState({
                error: "Provide a name for the key"
            });
        }

        this.setState({ submitted: true }, () => {
            this.props.onCreate(name, permissions);
        });
    };

    handlePermissionChange = (key, value) => {
        this.setState({ permissions: { ...this.state.permissions, [key]: value } });
    };

    render() {
        let content;

        if (this.state.show) {
            content = (
                <StyledCreateAPIKey>
                    <strong>Here is your key.</strong>
                    <small>Make note of it now. For security purposes, it will not be shown again.</small>

                    <StyledFlex alignItems="stretch" alignContent="stretch">
                        <FlexItem grow={1}>
                            <InputContainer align="right">
                                <CreateAPIKeyInput value={this.props.newKey} readOnly />
                                <CopyToClipboard text={this.props.newKey} onCopy={this.handleCopy}>
                                    <InputIcon name="copy" />
                                </CopyToClipboard>
                            </InputContainer>
                        </FlexItem>
                    </StyledFlex>

                    <CreateAPIKeyCopied show={this.state.copied}>
                        <Icon name="check" /> Copied
                    </CreateAPIKeyCopied>
                </StyledCreateAPIKey>
            );
        } else {
            content = (
                <React.Fragment>
                    <ModalHeader>Create API Key</ModalHeader>
                    <CreateAPIKeyInfo />

                    <form onSubmit={this.handleSubmit}>
                        <ModalBody>
                            <InputGroup>
                                <InputLabel>Name</InputLabel>
                                <Input label="Name" value={this.state.name} onChange={this.handleChange} />
                                <InputError>{this.state.error}</InputError>
                            </InputGroup>

                            <label>Permissions</label>

                            <APIPermissions
                                keyPermissions={this.state.permissions}
                                onChange={this.handlePermissionChange}
                            />
                        </ModalBody>

                        <ModalFooter>
                            <SaveButton />
                        </ModalFooter>
                    </form>
                </React.Fragment>
            );
        }

        return (
            <Modal
                label="Create API Key"
                show={this.props.show}
                onHide={this.props.onHide}
                onExited={this.handleModalExited}
            >
                {content}
            </Modal>
        );
    }
}

export const mapStateToProps = state => ({
    show: routerLocationHasState(state, "createAPIKey"),
    newKey: state.account.newKey,
    permissions: state.account.permissions
});

export const mapDispatchToProps = dispatch => ({
    onCreate: (name, permissions) => {
        dispatch(createAPIKey(name, permissions));
    },

    onHide: () => {
        dispatch(pushState({ createAPIKey: false }));
        dispatch(clearAPIKey());
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(CreateAPIKey);
