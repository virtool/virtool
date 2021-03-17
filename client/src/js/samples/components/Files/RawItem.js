import { includes } from "lodash-es";
import React from "react";
import styled from "styled-components";
import { BoxGroupSection, Flex, FlexItem } from "../../../base";
import { byteSize } from "../../../utils/utils";

export const getFileIconName = name => (includes(name, ".gz") ? "file-archive" : "file");

const StyledSampleRawItem = styled(BoxGroupSection)`
    align-items: flex-start;
    display: flex;
    justify-content: space-between;
`;

export const SampleRawItem = ({ name, download_url, from, size }) => (
    <StyledSampleRawItem>
        <Flex alignItems="center">
            <i className={`fas fa-${getFileIconName(name)} fa-fw`} style={{ fontSize: "24px" }} />
            <FlexItem pad={10}>
                <div>
                    <strong>
                        <a href={download_url} download>
                            {name}
                        </a>
                    </strong>
                </div>
                <div>
                    <small>Created from {from.name}</small>
                </div>
            </FlexItem>
        </Flex>
        <strong>{byteSize(size)}</strong>
    </StyledSampleRawItem>
);
