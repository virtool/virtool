import Numeral from "numeral";
import Request from "superagent";
import { get, startCase, capitalize } from "lodash-es";

export const taskDisplayNames = {
    nuvs: "NuVs",
    pathoscope_bowtie: "PathoscopeBowtie",
    pathoscope_snap: "PathoscopeSNAP"
};

export const getTaskDisplayName = taskName => get(taskDisplayNames, taskName, startCase(this.props.taskPrefix));

export const numberDictionary = {
    0: "zero",
    1: "one",
    2: "two",
    3: "three",
    4: "four",
    5: "five",
    6: "six",
    7: "seven",
    8: "eight",
    9: "nine"
};

export const numberToWord = (number) => numberDictionary[Number(number)] || number;

export const byteSize = bytes => Numeral(bytes).format("0.0 b");

export const toScientificNotation = (number) => {
    if (number < 0.01 || number > 1000) {
        const split = number.toExponential().split("e");
        const exponent = split[1].replace("+", "");
        return Numeral(split[0]).format("0.00") + "e" + exponent;
    }

    return Numeral(number).format("0.000");
};

export function formatIsolateName (isolate) {
    if (
        isolate.source_type && isolate.source_type !== "unknown" ||
        isolate.sourceType && isolate.sourceType !== "unknown"
    ) {
        return (
            capitalize(isolate.source_type || isolate.sourceType) + " "
            + (isolate.source_name || isolate.sourceName)
        );
    }

    return "Unnamed";
}

export function postJSON (uri, data, callback) {
    Request.post(uri)
        .send(data)
        .type("application/x-www-form-urlencoded; charset=UTF-8")
        .accept("json")
        .end((err, response) => {
            callback(response.body)
        });
}
