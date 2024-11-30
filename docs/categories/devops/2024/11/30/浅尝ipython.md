---
title: 浅尝ipython
date: 2024-11-30 00:00:00
categories: 
  - devops
tags:
  - ipython
---
# 浅尝ipython
::: tip
ipython是一个强大的python交互式shell，它比python自带的shell功能更强大，支持tab补全、自动缩进、内置帮助等功能。
:::
在容器内排查问题，很多工具都没有，这时候我们可以使用python requests来进行模拟请求，但是python自带的shell功能比较弱，这时候我们可以使用ipython来进行交互式的调试。
## 我的案例
使用requests排查问题
```shell
In [6]: %debug
> /root/venv/lib/python3.8/site-packages/urllib3/util/connection.py(85)create_connection(
if source_address:
sock.bind(source_address)
sock.connect(sa)
return sock
ipdb> self._dns_host *** NameError: name
'self' is not defined,
ipdb> u
/root/venv/lib/python3.8/site-packages/urllib3/connection.py(174)_new_conn()
try:
conn = connection.create_connection(
(self._dns_host, self.port), self.timeout, **extra_kw
)
ipdb> self._dns_host
"starrocks-fe.starrocks.svc.test10.local" ipdb> d
> /root/venv/lib/python3.8/site-packages/urllib3/util/connection.py(85)create_connection()
if source_address:
sock.bind(source_address)
sock.connect(sa)
return sock
ipdb>
source_address
ipdb>
sa
'193.169.203.143', 80) ipdb>
```
- %debug: 进入上一次错误的堆栈
- u: 上一层
- d: 下一层
## 总结
python是系统自带的工具集，可以多了解一些增强类的工具，在特定的场景下有奇效。:zap::zap::zap: