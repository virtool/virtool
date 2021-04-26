import { includes } from "lodash-es";
import React from "react";
import styled from "styled-components";
import { fontWeight } from "../../../app/theme";
import { BoxGroupSection } from "../../../base";
import { byteSize } from "../../../utils/utils";

export const getFileIconName = name => (includes(name, ".gz") ? "file-archive" : "file");

const ReadItemMain = styled.div`
    align-items: center;
    display: flex;
`;

const StyledReadItem = styled(BoxGroupSection)`
    align-items: flex-start;
    display: flex;
    font-weight: ${fontWeight.thick};
    justify-content: space-between;
`;

export const ReadItem = ({ name, download_url, from, size }) => (
    <StyledReadItem>
        <ReadItemMain>
            <i className={`fas fa-${getFileIconName(name)} fa-fw`} style={{ fontSize: "24px" }} />
            <div>
                <a href={download_url} download>
                    {name}
                </a>
                {from && (
                    <div>
                        <small>Created from {from.name}</small>
                    </div>
                )}
            </div>
        </ReadItemMain>
        {byteSize(size)}
    </StyledReadItem>
);
