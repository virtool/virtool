import pymongo
import datetime
import binascii
import hashlib
import os

def change(username, password, db_name):
    salt, password = salt_hash(password)
    collection = pymongo.MongoClient()[db_name]["users"]

    collection.update({"_id": username}, {
        "$set": {
            "password": password,
            "salt": salt,
            "last_password_change": datetime.datetime.now().isoformat(),
            "reset": True
        }
    })

def salt_hash(password, salt=None):
    """
    Salt and hash a password. This method can be used for and generating new password records for the
    database checking passwords (by passing a salt with the password query).

    """
    # If salt is not provided, a new password hash is being generated, so make a new salt string
    if salt is None:
        salt = make_secret()

    # Hash the password prepended with salt
    password = hashlib.sha512(salt.encode("utf-8") + password.encode("utf-8")).hexdigest()

    # Return a dict of the salt and the hashed password + salt
    return (salt, password)


def make_secret(length=24):
    """ Generate a random 24-character ASCII string. Used for generating salts. """
    return binascii.hexlify(os.urandom(length)).decode()


if __name__ == "__main__":
    username = input("Username: ")
    password = input("Password: ")
    db_name = input("Database name: ")

    change(username, password, db_name)

    print("done")