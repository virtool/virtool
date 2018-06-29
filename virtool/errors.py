class AuthError(Exception):
    pass


class ClientError(Exception):
    pass


class DatabaseError(Exception):
    pass


class GitHubError(Exception):
    pass


class MongoConnectionError(Exception):
    pass


class NCBIError(Exception):
    pass


class ProxyError(Exception):
    pass


class InsufficientResourceError(Exception):
    pass


class SubprocessError(Exception):
    pass
