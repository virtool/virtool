import numbro from "numbro";
import React from "react";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { BoxGroup, BoxGroupHeader, Markdown, NarrowContainer, SideContainer, Table } from "../../../base";
import { getLibraryTypeDisplayName } from "../../utils";
import EditSample from "../Edit/Edit";
import SampleFileSizeWarning from "./FileSizeWarning.js";
import { Sidebar } from "./Sidebar/Sidebar";

const SampleDetailSidebarContainer = styled(SideContainer)`
    padding-left: 15px;
`;

const StyledSampleDetailGeneral = styled.div`
    align-items: stretch;
    display: flex;

    th {
        width: 220px;
    }
`;

export const SampleDetailGeneral = ({
    count,
    encoding,
    gc,
    host,
    isolate,
    lengthRange,
    libraryType,
    locale,
    name,
    notes,
    paired,
    subtraction
}) => (
    <StyledSampleDetailGeneral>
        <NarrowContainer>
            <SampleFileSizeWarning />
            <BoxGroup>
                <BoxGroupHeader>
                    <h2>General</h2>
                    <p>User-defined information about the sample.</p>
                </BoxGroupHeader>
                <Table>
                    <tbody>
                        <tr>
                            <th>Name</th>
                            <td>{name}</td>
                        </tr>
                        <tr>
                            <th>Host</th>
                            <td>{host}</td>
                        </tr>
                        <tr>
                            <th>Isolate</th>
                            <td>{isolate}</td>
                        </tr>
                        <tr>
                            <th>Locale</th>
                            <td>{locale}</td>
                        </tr>
                    </tbody>
                </Table>
            </BoxGroup>

            <BoxGroup>
                <BoxGroupHeader>
                    <h2>Library</h2>
                    <p>Information about the sequencing reads in this sample.</p>
                </BoxGroupHeader>
                <Table>
                    <tbody>
                        <tr>
                            <th>Encoding</th>
                            <td>{encoding}</td>
                        </tr>
                        <tr>
                            <th>Read Count</th>
                            <td>{count}</td>
                        </tr>
                        <tr>
                            <th>Library Type</th>
                            <td>{libraryType}</td>
                        </tr>
                        <tr>
                            <th>Length Range</th>
                            <td>{lengthRange}</td>
                        </tr>
                        <tr>
                            <th>GC Content</th>
                            <td>{gc}</td>
                        </tr>
                        <tr>
                            <th>Paired</th>
                            <td>{paired ? "Yes" : "No"}</td>
                        </tr>
                    </tbody>
                </Table>
            </BoxGroup>

            <BoxGroup>
                <BoxGroupHeader>
                    <h2>Default Subtractions</h2>
                    <p>This subtraction will be the default selection when creating an analysis.</p>
                </BoxGroupHeader>
                <Table>
                    <tbody>
                        <tr>
                            <th>Subtraction</th>
                            <td>
                                {subtraction ? (
                                    <Link to={`/subtraction/${subtraction.id}`}>{subtraction.name}</Link>
                                ) : (
                                    "None"
                                )}
                            </td>
                        </tr>
                    </tbody>
                </Table>
            </BoxGroup>

            <BoxGroup>
                <BoxGroupHeader>
                    <h2>Notes</h2>
                    <p>Additional notes about the sample.</p>
                </BoxGroupHeader>
                <Markdown markdown={notes} />
            </BoxGroup>
        </NarrowContainer>

        <SampleDetailSidebarContainer>
            <Sidebar />
        </SampleDetailSidebarContainer>

        <EditSample />
    </StyledSampleDetailGeneral>
);

export const mapStateToProps = state => {
    const { name, host, isolate, locale, paired, quality, library_type, subtraction, notes } = state.samples.detail;
    const { count, encoding, gc, length } = quality;

    return {
        encoding,
        host,
        isolate,
        locale,
        name,
        notes,
        paired,
        count: numbro(count).format("0.0 a"),
        gc: numbro(gc / 100).format("0.0 %"),
        libraryType: getLibraryTypeDisplayName(library_type),
        lengthRange: length.join(" - "),
        subtraction
    };
};

export default connect(mapStateToProps)(SampleDetailGeneral);
