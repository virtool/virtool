import React from "react";
import SampleFilesCache from "./Cache";
import SampleFilesLegacyAlert from "./LegacyAlert";
import SampleFilesRaw from "./Raw";

const SampleDetailFiles = () => (
    <div>
        <SampleFilesLegacyAlert />
        <SampleFilesRaw />
        <SampleFilesCache />
    </div>
);

export default SampleDetailFiles;
