import tempfile
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.backends.backend_pdf import PdfPages

import virtool.gen


def plot_composition(composition):
    labels = [
        "Guanine",
        "Adenine",
        "Thymine",
        "Cytosine",
    ]

    colors = [
        "#428BCA", # Guanine
        "#A94442", # Adenine
        "#3C763D", # Thymine
        "#777777", # Cytosine
    ]

    for i in range(0, 4):
        data = [pnt[i] for pnt in composition]

        plt.plot(range(1, len(data) + 1), data, color=colors[i])
        plt.plot(range(1, len(data) + 1), data, color=colors[i])
        plt.plot(range(1, len(data) + 1), data, color=colors[i])
        plt.plot(range(1, len(data) + 1), data, color=colors[i])

    plt.title('Nucleotide Composition')
    plt.xlabel('Read Position (bp)')
    plt.ylabel('Composition (%)')
    plt.ylim(0, 100)
    plt.xlim(1, len(composition))
    plt.tight_layout()

    handles = [mpatches.Patch(color=colors[i], label=labels[i]) for i in range(0, 4)]

    plt.legend(handles=handles, prop={"size": 6})


def plot_bases(bases):
    decile_color = "#FFF475"
    quartile_color = "#3C763D"

    x = range(1, len(bases) + 1)

    ten = [base[4] for base in bases]
    ninety = [base[5] for base in bases]

    for i in [4, 5]:
        plt.plot(x, ten, color=decile_color, alpha=0.5)

    plt.fill_between(x, ten, ninety, color=decile_color, alpha=0.5)

    lower = [base[2] for base in bases]
    upper = [base[3] for base in bases]

    plt.plot(x, lower, color=quartile_color, alpha=0.5)
    plt.plot(x, upper, color=quartile_color, alpha=0.5)

    plt.fill_between(x, lower, upper, color=quartile_color, alpha=0.5)

    line_colors = [
        "#A94442",
        "#428BCA"
    ]

    for i, color in enumerate(line_colors):
        plt.plot(range(1, len(bases) + 1), [base[i] for base in bases], color=color)

    plt.title('Quality Distribution at Read Positions')
    plt.xlabel('Read Position (bp)')
    plt.ylabel('Quality')
    plt.ylim(0, 45)
    plt.xlim(1, len(bases))
    plt.tight_layout()

    handles = [mpatches.Patch(color=line_colors[i], label=label) for i, label in enumerate(["Mean", "Median"])]

    handles.append(mpatches.Patch(color=decile_color, label="Decile"))
    handles.append(mpatches.Patch(color=quartile_color, label="Quartile"))

    plt.legend(handles=handles, prop={"size": 6}, loc='lower left')


def plot_sequences(sequences):

    plt.plot(range(1, len(sequences) + 1), sequences, color="#428BCA")

    plt.title('Sequence quality frequency')
    plt.xlabel('Sequence Quality')
    plt.ylabel('Frequency')
    plt.ticklabel_format(style='sci', axis='y')
    plt.tight_layout()


@virtool.gen.synchronous
def quality_report(quality):
    plt.figure(1)

    plt.subplot(211)
    plot_composition(quality["composition"])

    plt.subplot(212)
    plot_bases(quality["bases"])

    plt.figure(2)

    plt.subplot(211)
    plot_sequences(quality["sequences"])

    temp = tempfile.NamedTemporaryFile("w")
    name = temp.name

    with PdfPages(name) as pp:
        pp.savefig(1)
        pp.savefig(2)

    with open(name, "rb") as opened_temp:
        body = opened_temp.read()

    temp.close()

    plt.close(1)

    return body
