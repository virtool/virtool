import PropTypes from "prop-types";
import React from "react";
import { DialogOverlay, DialogContent } from "@reach/dialog";
import styled, { keyframes } from "styled-components";
import { Icon } from "./Icon";
import { BoxGroupSection, Box } from "./Box";

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
export const ModalDialogOverlay = styled(({ close, ...rest }) => <DialogOverlay {...rest} />)`
    animation: ${props => (props.close ? modalOverlayClose : modalOverlayOpen)} 0.3s;
    animation-fill-mode: forwards;
    background: hsla(0, 0%, 0%, 0.33);
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    overflow: auto;
    position: fixed;
    z-index: 9999;
`;

export const ModalDialogContent = styled(({ close, size, ...rest }) => <DialogContent {...rest} />)`
    animation: ${props => (props.close ? modalContentClose : modalContentOpen)} 0.3s;
    animation-fill-mode: forwards;
    background: white;
    box-shadow: rgba(0, 0, 0, 0.5) 0 5px 15px;
    margin: -70px auto;
    padding: 0;
    position: relative;
    width: ${props => (props.size === "lg" ? "900px" : "600px")};

    @media (max-width: 991px) {
        width: 600px;
    }
`;

const DialogHeader = styled(({ modalStyle, headerBorderBottom, capitalize, ...rest }) => <BoxGroupSection {...rest} />)`
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

export const DialogFooter = styled(({ modalStyle, ...rest }) => <Box {...rest} />)`
    border-left: none;
    border-right: none;
    border-bottom: none;
    border-top: ${props => (props.modalStyle === "danger" ? "none" : "")}
    justify-content: end;
    text-align: right;
    overflow-y: auto;
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
        const CloseButton = (
            <Icon
                name="times"
                onClick={() => {
                    this.props.onHide();
                    this.onClose();
                }}
                style={{ color: "grey" }}
            />
        );

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
                        <DialogHeader
                            modalStyle={this.props.modalStyle}
                            headerBorderBottom={this.props.headerBorderBottom}
                            capitalize={this.props.capitalize}
                        >
                            {this.props.headerText}
                            {CloseButton}
                        </DialogHeader>
                        {this.props.children}
                    </ModalDialogContent>
                </ModalDialogOverlay>
            </div>
        );
    }
}

ModalDialog.propTypes = {
    headerText: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    capitalize: PropTypes.string,
    headerBorderBottom: PropTypes.string,
    modalStyle: PropTypes.string,
    size: PropTypes.string,
    label: PropTypes.string.isRequired,
    onHide: PropTypes.func,
    onExited: PropTypes.func,
    onEnter: PropTypes.func,
    show: PropTypes.bool
};
