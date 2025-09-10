import numpy as np
print("Test")

import pandas as pd

import os


# create me a function for printing file in one dirercotry
def print_files_in_directory(directory):
    print(f"Files in directory {directory}:")
    for filename in os.listdir(directory):
        if os.path.isfile(os.path.join(directory, filename)):
            print(filename)
