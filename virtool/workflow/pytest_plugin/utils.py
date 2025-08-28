import arrow


class StaticTime:
    datetime = arrow.Arrow(2015, 10, 6, 20, 0, 0).naive
    iso = "2015-10-06T20:00:00Z"


SUBTRACTION_FILENAMES = (
    "subtraction.fa.gz",
    "subtraction.1.bt2",
    "subtraction.2.bt2",
    "subtraction.3.bt2",
    "subtraction.4.bt2",
    "subtraction.rev.1.bt2",
    "subtraction.rev.2.bt2",
)
