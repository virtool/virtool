import { DialogContent as ReachDialogContent, DialogOverlay as ReachDialogOverlay } from "@reach/dialog";
import "@reach/dialog/styles.css";
import { get } from "lodash-es";
import PropTypes from "prop-types";
import React, { useContext } from "react";
import styled, { keyframes } from "styled-components";
import { colors, getBorder } from "../app/theme";
import { Alert } from "./Alert";
import { BoxGroupSection } from "./Box";
import { CloseButton } from "./CloseButton";
import { Tabs } from "./Tabs";

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

export const getModalBackgroundColor = ({ color, theme }) => get(theme.color, color, theme.color.white);
export const getModalForegroundColor = ({ color, theme }) => (color ? theme.color.white : theme.color.black);

export const ModalAlert = styled(Alert)`
    border-left: none;
    border-right: none;
    border-radius: 0;
    display: flex;
    margin-bottom: 0;

    i {
        line-height: 20px;
    }

    p {
        margin-left: 5px;
    }
`;

export const ModalContent = styled(({ close, size, ...rest }) => <ReachDialogContent {...rest} />)`
    animation: ${props => (props.close ? modalContentClose : modalContentOpen)} 0.3s;
    animation-fill-mode: forwards;
    background: white;
    border-radius: ${props => props.theme.borderRadius.lg};
    box-shadow: ${props => props.theme.boxShadow.lg};
    margin: -70px auto;
    overflow: hidden;
    padding: 0;
    position: relative;
    width: ${props => (props.size === "lg" ? "900px" : "600px")};

    @media (max-width: 991px) {
        width: 600px;
    }
`;

export const ModalFooter = styled(({ modalStyle, ...rest }) => <BoxGroupSection {...rest} />)`
    border-left: none;
    border-right: none;
    border-bottom: none;
    border-top: ${props => (props.modalStyle === "danger" ? "none" : "")};
    justify-content: end;
    text-align: right;
    overflow-y: auto;
`;

export const ModalOverlay = styled(({ close, ...rest }) => <ReachDialogOverlay {...rest} />)`
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

const StyledModalHeader = styled(BoxGroupSection)`
    align-items: center;
    background-color: ${getModalBackgroundColor};
    border-bottom: none !important;
    color: ${getModalForegroundColor};
    display: flex;
    font-size: ${props => props.theme.fontSize.lg};
    font-weight: 500;
    height: 55px;
    justify-content: space-between;
    text-transform: ${props => props.capitalize};
`;

export const ModalHeader = ({ children, className }) => {
    const { color, onHide } = useContext(ModalContext);

    return (
        <StyledModalHeader className={className} color={color}>
            {children}
            <CloseButton onClick={onHide} />
        </StyledModalHeader>
    );
};

export const ModalBody = styled(BoxGroupSection)`
    border-top: ${getBorder};

    & ~ & {
        border-top: none;
    }

    ${ModalAlert} ~ & {
        border-top: none;
    }
`;

export const ModalContext = React.createContext({});

export const ModalBodyOverlay = styled.div`
    align-items: center;
    background-color: rgba(203, 213, 224, 0.7);
    display: flex;
    position: absolute;
    top: 0;
    right: 0;
    left: 0;
    bottom: 0;
    text-align: center;
    z-index: 10000;

    span {
        flex: auto;
        font-size: ${props => props.theme.fontSize.xxl};
        z-index: 10001;
    }
`;

export const ModalTabs = styled(Tabs)`
    border-bottom: none;
    margin-bottom: 0;
`;

export class Modal extends React.Component {
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
        const contextValue = {
            color: this.props.color,
            onHide: this.props.onHide
        };

        return (
            <ModalContext.Provider value={contextValue}>
                <ModalOverlay
                    isOpen={this.state.open}
                    close={this.state.close}
                    onAnimationEnd={this.onClosed}
                    onDismiss={() => {
                        this.props.onHide();
                        this.onClose();
                    }}
                >
                    <ModalContent
                        size={this.props.size}
                        aria-labelledby={this.props.label}
                        close={this.state.close}
                        onAnimationEnd={this.onClosed}
                        onAnimationStart={this.onOpen}
                    >
                        {this.props.children}
                    </ModalContent>
                </ModalOverlay>
            </ModalContext.Provider>
        );
    }
}

Modal.propTypes = {
    children: PropTypes.node,
    color: PropTypes.oneOf(colors),
    size: PropTypes.oneOf(["sm", "lg"]),
    label: PropTypes.string.isRequired,
    onHide: PropTypes.func.isRequired,
    onExited: PropTypes.func,
    onEnter: PropTypes.func,
    show: PropTypes.bool.isRequired
};
