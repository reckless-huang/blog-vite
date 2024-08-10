---
title: Django ORM优化
isOriginal: true
author: 宇峰
date: 2024/08/08 22:25
categories:
  - devops
tags:
  - django
  - orm
---
# 解决django_orm外键查询等性能问题
django中的orm是一个非常强大的工具，但是在使用的过程中，我们可能会遇到一些性能问题，比如外键查询等，这里我们就来解决这些问题。
## 从根本上看sql优化只有两个方向
1. 减少查询次数
2. 减少查询数据量
## 减少查询数据量
### only和defer
only和defer是两个方法，可以让我们只查询我们需要的字段，而不是全部字段，这样可以减少查询数据量。

过滤字段很多时可以使用only**反选**，少时使用defer**正选**


## 减少查询次数
### select_related和prefetch_related
对于你需要的所有部分的单个数据集的不同部分，多次访问数据库比单次查询所有内容的效率低。如果有一个查找，它在循环中执行，这点就尤其重要，当只需要一个查询时，最终会执行许多数据库查询。这时候就需要使用select_related和prefetch_related。

需要注意的是，select_related只能用于外键和一对一字段，而prefetch_related一般用于多对多和多对一字段。

## 从代码中的运算中优化
### values和values_list
values*使得orm在处理数据时，不会将数据转换为对象，而是直接返回字典（values_list返回元组），这样可以减少代码运算。

## debug
### 开启debug日志打印sql
在settings.py中设置
```python
        # 数据库日志
        'django.db': {
            'handlers': ['console'],
            'level': 'DEBUG',
            'propagate': False
        },
```
### 直接使用raw sql
如果以上方法都不能解决你的问题，那么你可以直接使用raw sql，这样可以直接控制sql语句，但是这样会使得代码不够优雅，不推荐使用。
## 参考文章
- [Django ORM优化](https://docs.djangoproject.com/zh-hans/5.0/topics/db/optimization/)
- [全职技术开发外包2023年终复盘（五）django查询优化手段及减少代码运算](https://mp.weixin.qq.com/s/4cFgA0i85k_sit6-OL0chw)
