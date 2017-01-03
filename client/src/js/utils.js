import Numeral from "numeral";
import Request from "superagent";
import { capitalize } from "lodash-es";

export function toScientificNotation (number) {

    if (number < 0.01 || number > 1000) {
        const split = number.toExponential().split("e");
        const exponent = split[1].replace("+", "");
        return Numeral(split[0]).format("0.00") + "e" + exponent;
    } else {
        return Numeral(number).format("0.000");
    }
}

export function byteSize (bytes) {
    return Numeral(bytes).format("0.0 b")
}

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

export function numberToWord (number) {
    return {
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
    }[Number(number)] || number;
}