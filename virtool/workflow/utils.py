def get_workflow_version():
    try:
        with open("VERSION") as f:
            return f.read().strip()
    except FileNotFoundError:
        return "UNKNOWN"
