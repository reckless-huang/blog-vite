---
title: 通过rest接口快速使用xxl-job
date: 2024-10-15 00:00:00
categories: 
  - devops
tags:
  - xxl-job
  - python
  - rest
---
# 通过rest接口快速使用xxl-job
xxl-job是一个**分布式任务调度平台**，在java领域有很好的应用，我们开发运维平台时也有很多定时任务，循坏任务等，django自带的定时任务可视化不太好，celery又太重，考虑业务侧已经在使用了，调研了这个工具。   
## sdk ? rest
在社区有小伙伴为python封装了[pyxxl](https://github.com/fcfangcc/pyxxl),看了实现还是很巧妙的，但是我们框架是django，不太想引入这个依赖， 同时我们的业务也不是很复杂，所以我们选择了rest接口。
## rest接口
主要就两个接口，一个是**调度任务**，另外一个是**回调任务状态**。  
这里不得不说一下我是如何找到这两个接口的，吐槽一下官方的doc是真的不太友好。因为我们没有sdk，所以注册器我们肯定是**手动注册**的，然后不同的任务类型其实对我们没啥用，因为我只是把他当触发器来使用，所以随便选一个python任务，然后执行查看调用日志。   
从日志中发现他会发送POST请求到注册地址+/run这样一个地址，debug可以获取到他的数据结构，调度阶段需要你返回特定的数据结构，这个在官方文档中有说明。调度成功后，需要执行器回调执行结果，不然会超时提示任务失败。   
明白了这个就好说了，直接上代码
```python
path('unfinishedworkorder/run', tasks.unfinishedworkorder),
def unfinishedworkorder(request):
    """
    每天10点统计未完成工单
    """
    data = json.loads(request.body)
    unfinished = Workorder.objects.filter(finish=False, process__in=[1, 14], create_datetime__lt=datetime.now() - timedelta(days=14))
    report = '还有以下工单未完成：\n'
    if unfinished.count() == 0:
        report = '️🎉 所有工单已完成\n'
    for i in unfinished:
        report += f'客户：{i.customer.shortname if i.customer else "NULL"}\n项目：{i.project.describe if i.project else "NULL"}\n工单：[{i.title}](https://cloud.shuyilink.com/#/process/workorderdetail/{i.id}) \n'
        report += '-----------------------------------\n'
    print(report)
    msg_srv.simple_message_to_devops("未完成工单统计", report)
    jobid = data.get('logId')
    async_task('common.utils.xxlopt.xxl.callback', data.get('logId'), data.get('logDateTime'), True, '发送通知成功', task_name=f'xxl-{jobid}-callback')
    return JsonResponse({'code': 200, 'msg': '发送通知成功'})
```
简单的client
```python
import json

import requests

domain = "xxxxxxx"


class XxlOpt(object):
    def __init__(self):
        self.url = f"{domain}/api/"

    def callback(self, logId, logDateTime, success, msg=None):
        url = f"{self.url}/callback"
        data = [{
            "logId": logId,
            "logDateTime": logDateTime,
            "handleCode": 200 if success else 500,
            "handleMsg": msg
        }]
        response = requests.post(url, data=json.dumps(data))
        print(response.text)
        return json.loads(response.text)


xxl = XxlOpt()
```
## next
最近我们小组内的同学调研了另一款工具[Cronicle](https://github.com/jhuckaby/Cronicle),使用nodejs开发，功能场景上更契合运维开发，这里做个补充。    
可以用这个yaml部署看看效果
```yaml
---
apiVersion: apps/v1
kind: Deployment
metadata:
  annotations: {}
  labels:
    app: cronicle
  name: cronicle
  namespace: cronicle
  resourceVersion: '443501383'
spec:
  progressDeadlineSeconds: 600
  replicas: 1
  revisionHistoryLimit: 10
  selector:
    matchLabels:
      app: cronicle
  strategy:
    rollingUpdate:
      maxSurge: 25%
      maxUnavailable: 25%
    type: RollingUpdate
  template:
    metadata:
      annotations:
        kubectl.kubernetes.io/restartedAt: '2024-11-04T11:50:58+08:00'
      creationTimestamp: null
      labels:
        app: cronicle
    spec:
      containers:
        - image: 'soulteary/cronicle:0.9.59'
          imagePullPolicy: IfNotPresent
          name: cronicle
          resources: {}
          terminationMessagePath: /dev/termination-log
          terminationMessagePolicy: File
          volumeMounts:
            - mountPath: /opt/cronicle/data
              name: data
              subPath: data
            - mountPath: /opt/cronicle/logs
              name: data
              subPath: logs
            - mountPath: /opt/cronicle/plugins
              name: data
              subPath: plugins
            - mountPath: /opt/cronicle/conf/config.json
              name: config
              subPath: config.json
      dnsPolicy: ClusterFirst
      restartPolicy: Always
      schedulerName: default-scheduler
      securityContext: {}
      terminationGracePeriodSeconds: 30
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: cronicle-data
        - configMap:
            defaultMode: 420
            name: cronicle-config
          name: config

---
apiVersion: v1
kind: Service
metadata:
  annotations: {}
  labels:
    app: cronicle
  name: cronicle
  namespace: cronicle
  resourceVersion: '440972554'
spec:
  clusterIP: 10.96.114.203
  ports:
    - name: '3012'
      port: 3012
      protocol: TCP
      targetPort: 3012
  selector:
    app: cronicle
  sessionAffinity: None
  type: ClusterIP
```
## 总结
通过rest调用的话就轻量了不少，同时他的页面还算ok，可以看到任务的执行情况。在运维开发上，往往解决问题的方式有很多种，选择适合自己的就好。