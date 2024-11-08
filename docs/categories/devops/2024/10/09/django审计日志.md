---
title: django审计日志
date: 2024-10-09 00:00:00
categories:
 - devops
tags:
 - django
 - 审计日志
 - 数据可视化
 - wsgi
 - asgi
---
# django审计日志
::: tip
对于内部平台而言，审计日志是非常重要的，可以记录用户的操作行为，以便后续的追溯和分析。
:::
django生态中有很好的集成工具，我们这次使用的是`Django Easy Audit`
## 安装
1. 通过运行 安装 Django Easy Audit。
``` shell 
pip install django-easy-audit
```
或者，您可以从 GitHub 下载最新版本，将其解压缩，然后将文件夹“easyaudit”放在项目的根目录中。
我推荐使用压缩包，一方面是因为我们的django版本是3.2，已经out of date了，另一方面是因为直接使用源码可以二开。    
2. 将 'easyaudit' 添加到INSTALLED_APPS
``` python
   INSTALLED_APPS = [
   ...
   'easyaudit',
   ]
```
3. 将 Easy Audit 的中间件添加到您的 （或 ） 设置中，如下所示：MIDDLEWAREMIDDLEWARE_CLASSES
``` python
   MIDDLEWARE = (
   ...
   'easyaudit.middleware.easyaudit.EasyAuditMiddleware',
   )
```
4. 运行 以创建应用程序的模型。
``` shell
python manage.py migrate easyaudit
```
5. 就是这样！现在，整个项目上的每个 CRUD 事件都将在审计模型中注册，您将能够从 Django 管理应用程序查询这些模型。此外，此应用程序还将记录所有身份验证事件和请求的所有 URL。
## 配置
### 配置忽略特定URL
``` python
UNREGISTERED_URLS = [r'^/admin/', r'^/static/', r'^/favicon.ico$', r'^/health$', r'^/api/getRoutes/$',
                     r'^/api/metrics/$']
```
### 忽略某些模型的curd
``` python
DJANGO_EASY_AUDIT_UNREGISTERED_CLASSES_EXTRA
```
## 可视化
通过superset可以使用数据库中的数据进行可视化，数据源+dataset+dashboard+chart
## 踩坑
### 中间件不支持异步
debug时会报错   
django.core.exceptions.SynchronousOnlyOperation: You cannot call this from an async context - use a thread or sync_to_async.  
参考这个pr改写中间件  
1. Middleware 的修改
   在这个 pull request 中，EasyAuditMiddleware 被修改为同时支持同步和异步操作。以下是主要的修改点：   
   __init__ 方法：   
        - get_response 参数现在有一个明确的类型提示，表明它是一个返回 HttpResponse 的函数。   
        - 如果 get_response 是一个异步函数（通过 iscoroutinefunction 检查），则使用 markcoroutinefunction 将其标记为协程函数。   
   __call__ 方法：   
        - 修改了 __call__ 方法，以便根据 get_response 是否为异步函数来决定如何处理请求。   
        - 如果 self 是一个异步函数，则调用新的 __acall__ 方法。  
   新增 __acall__ 方法：  
        - 这是一个异步版本的 __call__ 方法，用于处理异步请求。   
        - 它使用 await 来等待 get_response 函数的结果。  
2. 线程局部存储的修改
   之前使用 threading.local() 来存储当前请求的信息，这在异步环境中不适用。   
   现在使用 asgiref.local.Local()，这是一个适用于异步环境的本地存储。
3. 处理请求和响应的方法
   process_request 和 process_response 方法被修改，以确保它们能够处理异步请求。   
   process_exception 方法保持不变，因为它通常不涉及异步操作。
修改后的中间件代码如下：
``` python
# makes easy-audit thread-safe
import contextlib
from typing import Callable

from asgiref.local import Local
from asgiref.sync import iscoroutinefunction, markcoroutinefunction
from django.http.request import HttpRequest
from django.http.response import HttpResponse


class MockRequest:
    def __init__(self, *args, **kwargs):
        user = kwargs.pop("user", None)
        self.user = user
        super().__init__(*args, **kwargs)


_thread_locals = Local()


def get_current_request():
    return getattr(_thread_locals, "request", None)


def get_current_user():
    request = get_current_request()
    if request:
        return getattr(request, "user", None)
    return None


def set_current_user(user):
    try:
        _thread_locals.request.user = user
    except AttributeError:
        request = MockRequest(user=user)
        _thread_locals.request = request


def clear_request():
    with contextlib.suppress(AttributeError):
        del _thread_locals.request


class EasyAuditMiddleware:
    async_capable = True
    sync_capable = True

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response
        if iscoroutinefunction(self.get_response):
            markcoroutinefunction(self)

    def __call__(self, request: HttpRequest) -> HttpResponse:
        # print("2")
        if iscoroutinefunction(self):
            return self.__acall__(request)

        _thread_locals.request = request
        response = self.get_response(request)

        with contextlib.suppress(AttributeError):
            del _thread_locals.request

        return response

    async def __acall__(self, request: HttpRequest) -> HttpResponse:
        # print("3")
        _thread_locals.request = request

        response = await self.get_response(request)

        with contextlib.suppress(AttributeError):
            del _thread_locals.request

        return response
```
### 支持从jwt token获取用户，而不是默认的session
默认的方法不能正确获取用户,修改request_signals.py
``` python
    user = None
    user_id = None
    # get the user from http auth
    if not user_id:
        headers = dict(scope.get('headers'))
        try:
            auth_string = headers.get(b'authorization')
            if isinstance(auth_string, bytes):
                auth_string = auth_string.decode("utf-8")
            jwt_token = (
                auth_string.split(" ")[1] if auth_string.startswith("JWT") else auth_string
            )
            jwt_token_decoded = jwt.decode(jwt_token, None, None)
            user_id = jwt_token_decoded["user_id"]
        except:
            user_id = None
```
### 修复登录日志
默认不支持记录飞书等第三方登录的日志，修改login_signals.py, 主动发送信号量
``` python
class LocalJSONWebTokenSerializer(JSONWebTokenSerializer):
    def validate(self, attrs):
        credentials = {
            self.username_field: attrs.get(self.username_field),
            'password': attrs.get('password')
        }

        if all(credentials.values()):
            user = authenticate(**credentials)

            if user:
                if not user.is_active:
                    msg = _('User account is disabled.')
                    raise serializers.ValidationError(msg)

                payload = jwt_payload_handler(user)
                signals.user_logged_in.send(sender=self.__class__, request=self.context['request'], user=user)
                return {
                    'token': jwt_encode_handler(payload),
                    'user': user
                }
            else:
                msg = _('Unable to log in with provided credentials.')
                signals.user_login_failed.send(sender=self.__class__, credentials=credentials)
                raise serializers.ValidationError(msg)
        else:
            signals.user_login_failed.send(sender=self.__class__, credentials=credentials)
            msg = _('Must include "{username_field}" and "password".')
            msg = msg.format(username_field=self.username_field)
            raise serializers.ValidationError(msg)


class LocalObtainJSONWebToken(ObtainJSONWebToken):
    serializer_class = LocalJSONWebTokenSerializer


oauth2_obtain_jwt_token = Oauth2JSONWebToken.as_view()
local_obtain_jwt_token = LocalObtainJSONWebToken.as_view()
```
### 序列化数据错误
默认对datetime字段序列化错误，会产生大量的错误日志，看issue发现目前还没解决，暂时先忽略错误   
https://github.com/soynatan/django-easy-audit/issues/132
``` python

        try:
            object_json_repr = serializers.serialize("json", [instance])
            print(instance)
        except Exception:
            return False
```
## 兼容wsgi
在request_signals.py中，我从scope中获取jwt token，但是wsgi中没有scope，所以需要兼容wsgi，从environ中获取jwt token
``` python
    auth_string = None
    if environ:
        path = environ["PATH_INFO"]
        auth_string = environ.get('HTTP_AUTHORIZATION')
        cookie_string = environ.get('HTTP_COOKIE')
        remote_ip = environ.get(REMOTE_ADDR_HEADER, None)
        method = environ['REQUEST_METHOD']
```
### wsgi vs asgi
sgi 是服务器网关接口（Server Gateway Interface）的缩写，是一种 Web 服务器和 Web 应用程序之间的通信协议。
- WSGI
多线程并发，不支持websocket
- ASGI
单线程协程，支持websocket
> 相对而言asgi适合短平快的高并发，这样可以协程调度，但是会被长时间的请求阻塞    
wsgi通过多个线程处理请求，适合长时间的请求，但是会消耗更多的资源，在我们的cmdb中存在比较多的同步长时间请求，所以我们选择wsgi
### 调试wsgi
直接使用 gunicorn -b 0.0.0.0:8080 -w 8  搭配print调试


## 总结
插件的整体思路就是信号量来触发不同的事件，然后记录到数据库中，这样就可以实现审计日志的功能。