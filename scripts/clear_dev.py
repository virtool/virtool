import pymongo
import shutil
import os

shutil.rmtree('data')
os.remove('settings.json')

client = pymongo.MongoClient()

client.drop_database("virtool-dev")