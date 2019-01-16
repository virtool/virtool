import aiohttp
import virtool.errors
import virtool.http.proxy

TEST_URL = "https://www.example.com"

TIMEOUT = aiohttp.ClientTimeout(total=10)


async def check(client, proxy):
    if not proxy:
        return {
            "proxy": proxy,
            "error": "value_error",
            "ready": False
        }

    settings = {
        "proxy": proxy
    }

    try:
        async with virtool.http.proxy.ProxyRequest(settings, client.get, TEST_URL, timeout=TIMEOUT) as resp:
            if resp.status != 200:
                return {
                    "proxy": proxy,
                    "error": "internet_error",
                    "ready": False
                }
    except virtool.errors.ProxyError:
        return {
            "proxy": proxy,
            "error": "auth_error",
            "ready": False
        }
    except aiohttp.ClientProxyConnectionError:
        return {
            "proxy": proxy,
            "error": "connection_error",
            "ready": False
        }
    except ValueError as err:
        if "Only http proxies are supported" in str(err):
            return {
                "proxy": proxy,
                "error": "https_error",
                "ready": False
            }

        raise

    return {
        "proxy": proxy,
        "error": "",
        "ready": True
    }
