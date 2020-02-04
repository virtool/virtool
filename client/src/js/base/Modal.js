import React from "react";
import { Modal as BsModal } from "react-bootstrap";

import { DialogOverlay, DialogContent } from "@reach/dialog";

import styled, { keyframes } from "styled-components";
import { BoxGroupSection, Box } from "./Box";
import { Alert } from "./Alert";

export const Modal = styled(BsModal)`
    ${Alert} {
        border-left: none;
        border-radius: 0;
        border-right: none;
        margin: -1px 0 0;
    }
`;

const modalOverlayIn = keyframes`
    0% {
        background: rgba(255, 255, 255, 0);
    }
    100% {
        background: rgba(0, 0, 0, 0.5);
    }
`;

const modalOverlayOut = keyframes`
    0% {
      background: rgba(0, 0, 0, 0.5);
    }
    100% {
        background: rgba(255, 255, 255, 0);
    }
`;

const modalContentIn = keyframes`
    0% {
      opacity: 0;
    }
    100% {
      transform: translate(0,80px);
    }
`;

const modalContentOut = keyframes`
    0% {
      transform: translate(0,80px);
    }
    100% {
        opacity: 0;
    }
`;
export const ModalDialogOverlay = styled(({ show, out, ...rest }) => <DialogOverlay {...rest} />)`
    z-index: 9999;

    animation: ${props => (props.out ? modalOverlayOut : modalOverlayIn)} 0.4s;
    animation-fill-mode: forwards;
`;

export const ModalDialogContent = styled(({ size, out, ...rest }) => <DialogContent {...rest} />)`
    margin-top: -50px;
    overflow-y: overlay;
    box-shadow: rgba(0, 0, 0, 0.5) 0px 5px 15px;
    width: ${props => (props.size == "lg" ? "900px" : "600px")};
    padding: 0;
    position: relative;

    animation: ${props => (props.out ? modalContentOut : modalContentIn)} 0.4s;
    animation-fill-mode: forwards;

    @media (max-width: 991px) {
        width: 600px;
    }
`;

export const DialogHeader = styled(BoxGroupSection)`
    height: 55px;
    display: flex;
    align-items: center;
`;

export const DialogBody = styled.div`
    padding: 15px;
`;

export const DialogFooter = styled(Box)`
    display: flex;
    justify-content: end;
    border-bottom: none;
`;

export class ModalDialog extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            open: false,
            out: false
        };
    }

    onOut = () => {
        this.setState({ out: true });
    };

    onAnimationEnd = () => {
        if (this.state.out == true) {
            this.setState({ open: false, out: false });
        }
    };

    onAnimationStart = () => {
        if (this.state.in == true) {
            () => this.props.onEnter();
        }
    };

    render() {
        if (this.props.show == true) {
            this.state.open = true;
        }
        return (
            <div>
                <ModalDialogOverlay
                    isOpen={this.state.open}
                    out={this.state.out}
                    onAnimationEnd={this.onAnimationEnd}
                    show={this.props.show}
                    onDismiss={() => {
                        this.props.onHide();
                        this.props.onExited();
                        this.onOut();
                    }}
                >
                    <ModalDialogContent
                        size={this.props.size}
                        aria-labelledby={this.props.label}
                        out={this.state.out}
                        onAnimationEnd={this.onAnimationEnd}
                        onAnimationStart={this.onAnimationStart}
                    >
                        {this.props.children}
                    </ModalDialogContent>
                </ModalDialogOverlay>
            </div>
        );
    }
}
