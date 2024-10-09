---
title: django审计日志
date: 2024-10-09
categories:
 - devops
tags:
 - django
 - 审计日志
 - 数据可视化
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