---
title: django调试小技巧
date: 2024-10-13 00:00:00
categories: [devops]
tags: [django, 调试]
---
# 调试django工程
::: tip
调试是解决问题的终极手段！！！
:::
## 使用djangoshell
当然可以直接在shell中使用
```shell
python manage.py shell
```
但是这样没有代码补全，不是那么好用，可以用一个py脚本实现同样的效果
```python
import os

os.environ['CONFENV'] = 'test'
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'syglops.settings')

import django
django.setup()


from cmdb.models import *

your_code_here
```
这样可以使用ide的代码补全功能，同时支持断点调试
## 采集标准输出到日志平台
对于django而言，总是有一些输出是没记录到日志文件的，特别是一些异常，所以最好采集std到elk等日志平台
## 接入apm
apm可以帮助我们更好的了解程序的性能瓶颈，可以更好的优化程序。   
比如使用elastic apm，可以轻松的看到接口调用时间等信息，辅助问题排查
## 总结
其实上面的方法不局限于django，对于大部分的软件工程是一样的，可观测的三个重要指标，logging， tracing，metrics