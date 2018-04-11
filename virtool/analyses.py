import aiofiles
import json
import os

import virtool.db.history
import virtool.jobs.analysis


def coverage_to_coordinates(coverage_list):
    previous_depth = coverage_list[0]
    coordinates = {(0, previous_depth)}

    last = len(coverage_list) - 1

    for i, depth in enumerate(coverage_list):
        if depth != previous_depth or i == last:
            coordinates.add((i - 1, previous_depth))
            coordinates.add((i, depth))

            previous_depth = depth

    coordinates = sorted(list(coordinates), key=lambda x: x[0])

    return coordinates


def get_nuvs_json_path(data_path, analysis_id, sample_id):
    return os.path.join(
        data_path,
        "samples",
        analysis_id,
        "analysis",
        sample_id,
        "nuvs.json"
    )


def get_square_distance(p1, p2):
    """
    Get the square of the distance between two points.

    """
    dx = p1[0] - p2[0]
    dy = p1[1] - p2[1]

    return dx * dx + dy * dy


def get_square_segment_distance(p, p1, p2):
    """
    Get the square distance between a point and a segment.

    """
    x, y = p1

    dx = p2[0] - x
    dy = p2[1] - y

    if dx != 0 or dy != 0:
        t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy)

        if t > 1:
            x, y = p2
        elif t > 0:
            x += dx * t
            y += dy * t

    dx = p[0] - x
    dy = p[1] - y

    return dx * dx + dy * dy


def simplify_douglas_peucker(points, tolerance):
    length = len(points)
    markers = [0] * length

    first = 0
    last = length - 1

    first_stack = list()
    last_stack = list()

    new_points = list()

    markers[first] = 1
    markers[last] = 1

    while last:
        max_squared_distance = 0

        for i in range(first, last):
            squared_distance = get_square_segment_distance(points[i], points[first], points[last])

            if squared_distance > max_squared_distance:
                index = i
                max_squared_distance = squared_distance

        if max_squared_distance > tolerance:
            markers[index] = 1

            first_stack.append(first)
            last_stack.append(index)

            first_stack.append(index)
            last_stack.append(last)

        # Can pop an empty array in Javascript, but not Python, so check
        # the length of the list first
        try:
            first = first_stack.pop()
        except IndexError:
            first = None

        try:
            last = last_stack.pop()
        except IndexError:
            last = None

    for i, point in enumerate(points):
        if markers[i]:
            new_points.append(point)

    return new_points


def simplify_radial_distance(points, tolerance):
    prev_point = points[0]
    new_points = [prev_point]

    point = None

    for point in points:
        if get_square_distance(point, prev_point) > tolerance:
            new_points.append(point)
            prev_point = point

    if point is not None and prev_point != point:
        new_points.append(point)

    return new_points


def smooth_coverage_coordinates(coordinates, tolerance=0.01):
    squared_tolerance = pow(tolerance, 2)

    return simplify_douglas_peucker(simplify_radial_distance(coordinates, squared_tolerance), squared_tolerance)
