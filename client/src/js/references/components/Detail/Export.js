import React, { useCallback } from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { pushState } from "../../../app/actions";
import { Button, Icon, Modal, ModalBody, ModalFooter, ModalHeader, VTLogo } from "../../../base";
import { followDownload, routerLocationHasState } from "../../../utils/utils";

const ExportReferenceDiagram = styled.div`
    align-items: center;
    display: flex;
    justify-content: center;
    font-size: 20px;

    > * {
        margin: 0;
    }

    > *:not(:first-child),
    > *:not(:last-child) {
        margin: 0 5px;
    }
`;

const ExportReferenceBody = styled(ModalBody)`
    text-align: center;

    > p {
        margin-top: 10px;
    }
`;

export const ExportReference = ({ id, show, onHide }) => {
    const handleSelect = useCallback(() => {
        followDownload(`/download/refs/${id}`);
        onHide();
    }, [id]);

    return (
        <Modal label="Export Reference" onHide={onHide} show={show}>
            <ModalHeader>Export Reference</ModalHeader>
            <ExportReferenceBody>
                <p>Create an file containing the reference that can be imported into other Virtool instances</p>
                <ExportReferenceDiagram>
                    <VTLogo /> <Icon name="long-arrow-alt-right" /> <Icon name="box" />
                    <Icon name="long-arrow-alt-right" /> <VTLogo />
                </ExportReferenceDiagram>
                <p>It may take some time for the file to be prepared</p>
            </ExportReferenceBody>
            <ModalFooter>
                <Button icon="download" onClick={handleSelect}>
                    Export
                </Button>
            </ModalFooter>
        </Modal>
    );
};

const mapStateToProps = state => ({
    id: state.references.detail.id,
    show: routerLocationHasState(state, "exportReference")
});

const mapDispatchToProps = dispatch => ({
    onHide: () => {
        dispatch(pushState({ exportReference: false }));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(ExportReference);
