def is_running_or_waiting(document):
    latest_state = document["status"][-1]["state"]
    return latest_state == "waiting" or latest_state == "running"
