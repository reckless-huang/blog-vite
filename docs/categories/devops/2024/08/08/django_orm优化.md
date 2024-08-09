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
3. 减少计算次数
## 减少查询数据量
### only和defer
## 减少计算次数
### values和values_list
## 减少查询次数
### select_related和prefetch_related
## 参考文章
- [Django ORM优化](https://docs.djangoproject.com/zh-hans/5.0/topics/db/optimization/)
- [全职技术开发外包2023年终复盘（五）django查询优化手段及减少代码运算](https://mp.weixin.qq.com/s/4cFgA0i85k_sit6-OL0chw)
