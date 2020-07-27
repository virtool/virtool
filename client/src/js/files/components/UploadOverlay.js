import React from "react";
import styled from "styled-components";
import { map, reject, sortBy } from "lodash-es";
import { connect } from "react-redux";
import { Badge, BoxGroup, BoxGroupHeader, BoxGroupSection } from "../../base";
import { UploadItem } from "./UploadItem";

const StyledUploadOverlay = styled.div`
    ${props => (props.show ? "" : "display: none;")};
    position: fixed;
    bottom: 0;
    right: 0;
    width: 35%;
    max-width: 500px;
    z-index: 1040;
    padding: 0 15px 15px 0;
`;

const UploadOverlayContent = styled(BoxGroup)`
    background-color: ${props => props.theme.color.white};
    box-shadow: ${props => props.theme.boxShadow.lg};
    margin: 0;

    ${BoxGroupHeader} {
        display: block;
    }
`;

const UploadOverlayList = styled(BoxGroupSection)`
    height: auto;
    max-height: 200px;
    overflow-x: hidden;
    padding: 0;
`;

export const UploadOverlay = ({ uploads }) => {
    if (uploads.length) {
        const uploadComponents = map(uploads, upload => <UploadItem key={upload.localId} {...upload} />);

        return (
            <StyledUploadOverlay show={uploads.length}>
                <UploadOverlayContent>
                    <BoxGroupHeader>
                        <strong>Uploads</strong> <Badge>{uploadComponents.length}</Badge>
                    </BoxGroupHeader>
                    <UploadOverlayList>{uploadComponents}</UploadOverlayList>
                </UploadOverlayContent>
            </StyledUploadOverlay>
        );
    }

    return null;
};

export const mapStateToProps = state => {
    return { uploads: sortBy(reject(state.files.uploads, { fileType: "reference" }), "progress") };
};

export default connect(mapStateToProps)(UploadOverlay);
