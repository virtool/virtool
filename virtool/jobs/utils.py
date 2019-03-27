import hashlib
import json





def calculate_cache_hash(parameters):
    string = json.dumps(parameters, sort_keys=True)
    return hashlib.sha1(string.encode()).hexdigest()


def get_command(params):
    mode = "normal"



    parameters = get_parameters()



    command = [
        "skewer",
        "-m", "pe" if params["paired"] else "any",
        "-l", "20" if params["srna"] else "50",
        "-q", "20",
        "-Q", "25",
        "-t", str(self.proc),
        "-o", os.path.join(params["sample_path"], "reads"),
        "--quiet"
    ]

        input_paths = [os.path.join(self.settings["data_path"], "files", file_id) for file_id in self.params["files"]]



        # Trim reads to max length of 23 if the sample is sRNA.
        if self.params["srna"]:
            command += [
                "-L", "23",
                "-e"
            ]

        command += input_paths

        # Prevents an error from skewer when called inside a subprocess.


def get_parameters(mode=None):
    parameters = {
        "max_error_rate": 0.1,
        "max_indel_rate": 0.03,
        "end_quality": 20,
        "mean_quality": 25,
        "min_length": 50,
        "max_length": None,
        "filter_degenerate": False
    }

    if mode == "barcode":
        return {
            **parameters,
            "end_quality": 12,
            "mean_quality": 15
        }

    if mode == "srna":
        return {
            **parameters,

        }


    return parameters
