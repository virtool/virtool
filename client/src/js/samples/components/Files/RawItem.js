import { find, includes } from "lodash-es";
import numbro from "numbro";
import React from "react";
import { useDropzone } from "react-dropzone";
import { connect } from "react-redux";
import styled from "styled-components";
import { getColor } from "../../../app/theme";
import { AffixedProgressBar, BoxGroupSection, Flex, FlexItem, Icon } from "../../../base";
import { byteSize, createRandomString } from "../../../utils/utils";
import { uploadSampleFile } from "../../actions";

export const getFileIconName = name => (includes(name, ".gz") ? "file-archive" : "file");

export const SampleRawItemProgress = ({ upload = 0 }) => <AffixedProgressBar color="blue" now={upload.progress} />;

const StyledSampleRawItemStatus = styled.div`
    color: ${getColor};
    font-size: ${props => props.theme.fontSize.sm};
`;

export const SampleRawItemStatus = ({ job, raw, replacement, upload }) => {
    if (upload) {
        return (
            <StyledSampleRawItemStatus color="blue">
                UPLOADING ({numbro(upload.progress).format({ mantissa: 0 })}%)
            </StyledSampleRawItemStatus>
        );
    }

    if (replacement) {
        return (
            <StyledSampleRawItemStatus color="green">
                <Icon name="check" /> REPLACEMENT UPLOADED
            </StyledSampleRawItemStatus>
        );
    }

    if (job) {
        return (
            <StyledSampleRawItemStatus color="blue">
                REPLACING ({numbro(job.progress).format({ mantissa: 0 })}%)
            </StyledSampleRawItemStatus>
        );
    }

    if (!raw) {
        return (
            <StyledSampleRawItemStatus color="red">
                <small>TRIMMED</small>
            </StyledSampleRawItemStatus>
        );
    }

    return null;
};

const SampleRawItem = props => {
    const { name, download_url, from, onDrop, raw, sampleId, size, suffix, upload, replacement } = props;

    const { getRootProps } = useDropzone({ onDrop: files => onDrop(sampleId, suffix, files[0]) });

    return (
        <BoxGroupSection {...getRootProps()}>
            <SampleRawItemProgress upload={upload} />
            <Flex alignItems="flex-start" justifyContent="space-between">
                <FlexItem>
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
                </FlexItem>
                <FlexItem>
                    <div>
                        <div>
                            <strong>{byteSize(size)}</strong>
                        </div>
                        <SampleRawItemStatus upload={upload} raw={raw} replacement={replacement} />
                    </div>
                </FlexItem>
            </Flex>
        </BoxGroupSection>
    );
};

const mapStateToProps = (state, ownProps) => {
    const sampleId = state.samples.detail.id;

    const upload = find(
        state.files.uploads,
        ({ context }) => context.sampleId === sampleId && context.suffix === ownProps.suffix
    );

    return {
        sampleId,
        upload
    };
};

const mapDispatchToProps = dispatch => ({
    onDrop: (sampleId, suffix, file) => {
        const localId = createRandomString();
        dispatch(uploadSampleFile(localId, sampleId, suffix, file));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(SampleRawItem);
