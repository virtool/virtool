import { DialogContent, DialogOverlay } from "@reach/dialog";
import "@reach/dialog/styles.css";
import PropTypes from "prop-types";
import React from "react";
import styled, { keyframes } from "styled-components";
import { Alert } from "./Alert";
import { Box, BoxGroupSection } from "./Box";
import { CloseButton } from "./CloseButton";

const modalOverlayOpen = keyframes`
    0% {
        opacity: 0;
    }
`;

const modalOverlayClose = keyframes`
    100% {
        opacity: 0;
    }
`;

const modalContentOpen = keyframes`
    100% {
        transform: translate(0,100px);
    }
`;

const modalContentClose = keyframes`
    0% {
        transform: translate(0,100px);
    }
    100% {
        opacity: 0;
    }
`;

export const ModalAlert = styled(Alert)`
    border-left: none;
    border-right: none;
    border-radius: 0;
    display: flex;
    margin-bottom: 5px;

    i {
        line-height: 20px;
    }

    p {
        margin-left: 5px;
    }
`;

export const ModalDialogContent = styled(({ close, size, ...rest }) => <DialogContent {...rest} />)`
    animation: ${props => (props.close ? modalContentClose : modalContentOpen)} 0.3s;
    animation-fill-mode: forwards;
    background: white;
    border-radius: ${props => props.theme.borderRadius.sm};
    box-shadow: ${props => props.theme.boxShadow.lg};
    margin: -70px auto;
    padding: 0;
    position: relative;
    width: ${props => (props.size === "lg" ? "900px" : "600px")};

    @media (max-width: 991px) {
        width: 600px;
    }
`;

export const DialogFooter = styled(({ modalStyle, ...rest }) => <Box {...rest} />)`
    border-left: none;
    border-right: none;
    border-bottom: none;
    border-top: ${props => (props.modalStyle === "danger" ? "none" : "")}
    justify-content: end;
    text-align: right;
    overflow-y: auto;
`;

export const ModalDialogOverlay = styled(({ close, ...rest }) => <DialogOverlay {...rest} />)`
    animation: ${props => (props.close ? modalOverlayClose : modalOverlayOpen)} 0.2s;
    animation-fill-mode: forwards;
    background: hsla(0, 0%, 0%, 0.33);
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    overflow: auto;
    position: fixed;
    z-index: 9999;

    i.fas {
        z-index: 10000;
    }
`;

const ModalDialogHeader = styled(({ modalStyle, headerBorderBottom, capitalize, ...rest }) => (
    <BoxGroupSection {...rest} />
))`
    background-color: ${props => (props.modalStyle === "danger" ? "#d44b40" : "")};
    color: ${props => (props.modalStyle === "danger" ? "white" : "")};
    height: 55px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: ${props => props.headerBorderBottom} !important;
    text-transform: ${props => props.capitalize};
`;

export const DialogBody = styled.div`
    padding: 15px;
`;

export const ModalBodyOverlay = styled.div`
    text-align: center;
    position: absolute;
    display: flex;
    align-items: center;
    top: 0;
    right: 0;
    height: 100%;
    width: 100%;
    z-index: 10000;
    background-color: #777777;
    opacity: 0.7;

    span {
        flex: auto;
        color: white;
        font-size: 24px;
    }
`;

export class ModalDialog extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            open: false,
            close: false
        };
    }

    static getDerivedStateFromProps(props) {
        if (props.show === true) {
            return {
                open: true,
                close: false
            };
        }
        if (props.show === false) {
            return { close: true };
        }
        return null;
    }

    onClose = () => {
        this.setState({ close: true });
    };

    onClosed = () => {
        if (this.state.close === true) {
            this.setState({ open: false, close: false });

            if (this.props.onExited) {
                this.props.onExited();
            }
        }
    };

    onOpen = () => {
        if (this.state.open === true && this.state.close === false && this.props.onEnter) {
            this.props.onEnter();
        }
    };

    render() {
        return (
            <div>
                <ModalDialogOverlay
                    isOpen={this.state.open}
                    close={this.state.close}
                    onAnimationEnd={this.onClosed}
                    onDismiss={() => {
                        this.props.onHide();
                        this.onClose();
                    }}
                >
                    <ModalDialogContent
                        size={this.props.size}
                        aria-labelledby={this.props.label}
                        close={this.state.close}
                        onAnimationEnd={this.onClosed}
                        onAnimationStart={this.onOpen}
                    >
                        <ModalDialogHeader
                            modalStyle={this.props.modalStyle}
                            headerBorderBottom={this.props.headerBorderBottom}
                            capitalize={this.props.capitalize}
                        >
                            {this.props.headerText}
                            <CloseButton onClick={this.props.onHide} />
                        </ModalDialogHeader>
                        {this.props.children}
                    </ModalDialogContent>
                </ModalDialogOverlay>
            </div>
        );
    }
}

ModalDialog.propTypes = {
    capitalize: PropTypes.string,
    children: PropTypes.node,
    headerBorderBottom: PropTypes.string,
    headerText: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    modalStyle: PropTypes.string,
    size: PropTypes.string,
    label: PropTypes.string.isRequired,
    onHide: PropTypes.func,
    onExited: PropTypes.func,
    onEnter: PropTypes.func,
    show: PropTypes.bool
};
