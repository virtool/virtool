import React from "react";
import { NarrowContainer } from "../../../base";
import SampleFileSizeWarning from "../FileSizeWarning.js";
import SampleFilesMessage from "../LegacyAlert";
import SampleFilesCache from "./Cache";
import SampleFilesRaw from "./Raw";

export const SampleDetailFiles = () => (
    <NarrowContainer>
        <SampleFileSizeWarning />
        <SampleFilesMessage />
        <SampleFilesRaw />
        <SampleFilesCache />
    </NarrowContainer>
);
