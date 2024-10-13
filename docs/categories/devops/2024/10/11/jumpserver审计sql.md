---
title: jumpserver审计sql
date: 2024-10-11 00:00:00
categories: 
  - devops
tags:
  - jumpserver
  - 审计
  - sql
---
# jumpserver审计sql
::: tip
jumpserverv3带来了数据库的连接功能，其中db向导可以实现代理数据库连接，同时记录了sql语句，实现类似审计的功能。  需要注意的是这个功能在v4是企业版的功能,没太多可持续性。
:::
在我司开发sql主要通过archery操作,但是**部分其他部门的定时任务等是使用固定账号密码的**,可能带来使用风险,需要对他们的操作也进行审计。
## jumpserver api基操
官方文档: https://docs.jumpserver.org/zh/v4/dev/rest_api/#2-api   
一般而言先在页面上操作一遍,然后通过f12查看请求,获取到基本的api信息，然后就可以去接口文档中查找对应的api了。   
### debug
设置环境变量，可以看到debug日志同时返回的错误信息更偏向于开发者。   
```shell
            - name: DEBUG
              value: 'true'
            - name: LOG_LEVEL
              value: DEBUG
```
## 接口开发
实现注册数据库到jumpserver,并且获取连接信息。   
```python
import datetime
import json

import requests

TOKEN = 'sssssss'
Domain = 'xxxxxx'


class JmsV3Opt(object):
    def __init__(self, domain=None):
        self.url = f"{domain}/api/v1"
        self.private_token = TOKEN
        self.headers = {
            'Content-Type': 'application/json',
            "Authorization": f"Token {self.private_token}",
        }

    def get_database(self, name):
        url = f"{self.url}/assets/databases/?name={name}"
        response = requests.get(url, headers=self.headers)
        print(response.text)
        dbs = json.loads(response.text)
        if dbs:
            return dbs[0]['id']
        else:
            return None

    def update_database(self, id, **kwargs):
        url = f"{self.url}/assets/databases/{id}/"
        response = requests.patch(url, headers=self.headers, data=json.dumps(kwargs))
        print(response.text)

    def create_or_update_database(self, name, address, port, db_name):
        if self.get_database(name):
            self.update_database(self.get_database(name), address=address, protocols=[{"name": "mysql", "port": port}], db_name=db_name)
        else:
            self.create_database(name, address, port, db_name)

    def create_database(self, name, address, port, db_name):
        url = f"{self.url}/assets/databases/"
        body = {
            "platform": 17,
            "nodes": [
                "xxxxxxx"  # p-mysql
            ],
            "db_name": db_name,
            "protocols": [
                {
                    "name": "mysql",
                    "port": port
                }
            ],
            "use_ssl": False,
            "allow_invalid_cert": False,
            "labels": [],
            "is_active": True,
            "address": address,
            "name": name,
            "accounts": [
                {
                    "privileged": True,
                    "secret_type": "password",
                    "push_now": False,
                    "on_invalid": "error",
                    "is_active": True,
                    "name": "xxxx",
                    "username": "xxx",
                    "secret": "xxxx"
                }
            ]
        }
        response = requests.post(url, headers=self.headers, data=json.dumps(body))
        print(response.text)

    def get_db_info(self, name):
        if db := self.get_database(name):
            url = f"{self.url}/authentication/connection-token/"
            body = {
                "asset": db,
                "account": "xxxx",
                "protocol": "mysql",
                "input_username": "xxxx",
                "input_secret": "",
                "connect_method": "db_guide",
                "is_reusable": True,  # 是否可重复使用
                "connect_options": {
                    "charset": "default",
                    "disableautohash": False,
                    "resolution": "auto",
                    "backspaceAsCtrlH": False,
                    "appletConnectMethod": "web",
                }
            }
            response = requests.post(url, headers=self.headers, data=json.dumps(body))
            print(response.text)
            res= json.loads(response.text)
            return {
                'username': res['id'],
                'password': res['value'],
            }
        else:
            return None


JmsV3Client = JmsV3Opt(domain=Domain)

if __name__ == '__main__':
    print(JmsV3Client.get_database('xxxxx'))
    pass
    # JmsV3Client.create_database()
```
## 参考参数说明文档调整过期时间等
文档: https://docs.jumpserver.org/zh/v3/guide/env/    
示例: 3小时内可重复使用
```yaml
            - name: CONNECTION_TOKEN_REUSABLE
              value: 'true'
            - name: CONNECTION_TOKEN_EXPIRATION_MAX
              value: '10800'
            - name: CONNECTION_TOKEN_EXPIRATION
              value: '10800'
```
### 如何debug token过期    
调用authentication_connection-token的list接口，查看返回的参数明细
## 效果
通过cmdb获取的jms代理地址连接数据库，可以在jms中查看到sql执行记录，同时注册注销连接信息等，大大提高了数据库的安全性。   
最后提醒，这是v3版本专有的功能，v4要收费啦!!!
