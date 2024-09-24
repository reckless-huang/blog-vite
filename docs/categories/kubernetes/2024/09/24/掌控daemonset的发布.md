---
title: 掌控daemonset的发布
date: 2024-09-24
categories:
  - kubernetes
tags:
  - daemonset
  - 镜像预热
  - maxSurge
  - maxUnavailable
---
# 掌控daemonset的发布
我司产品的是云边模型，边端的服务都是通过DaemonSet部署在工控机上的，最近在一个100+的工厂中，遇到了流量过大，工控机无法正常拉取镜像的问题，其实之前在混合云环境已经增加了maxUnavailable的配置，但是这次行为好像不符合预期。
## 不生效的maxUnavailable和maxSurge
k8s滚动更新中控制速率主要依赖两个参数：   
**maxUnavailable**：和期望ready的副本数比，不可用副本数最大比例（或最大值），这个值越小，越能保证服务稳定，更新越平滑，<font style="color:rgb(15, 209, 93)">向下取整</font>；    
**maxSurge**：和期望ready的副本数比，超过期望副本数最大比例（或最大值），这个值调的越大，副本更新速度越快, <font style="color:rgb(15, 209, 93)">向上取整</font>。   
### maxSurge版本支持计划
参考 https://github.com/kubernetes/enhancements/issues/1591   
- Alpha release target 1.20
- Beta release target 1.21
- Stable release target 1.25  

我们的集群是1.19，so这个参数在我们的集群是无效的
### maxUnavailable似乎也没正常工作
模拟一个边端负载
```yaml
---
apiVersion: apps/v1
kind: DaemonSet
metadata:
  annotations:
    deprecated.daemonset.template.generation: '18'
  labels:
    k8s.kuboard.cn/name: testdsrollout
  name: testdsrollout
  namespace: reckless
spec:
  revisionHistoryLimit: 10
  selector:
    matchLabels:
      k8s.kuboard.cn/name: testdsrollout
  template:
    metadata:
      annotations:
        kubectl.kubernetes.io/restartedAt: '2024-09-24T10:06:00+08:00'
      creationTimestamp: null
      labels:
        k8s.kuboard.cn/name: testdsrollout
    spec:
      containers:
        - command:
            - sleep
            - '3600'
          image: busybox
          imagePullPolicy: IfNotPresent
          name: busybox
          resources: {}
          terminationMessagePath: /dev/termination-log
          terminationMessagePolicy: File
      dnsPolicy: ClusterFirst
      nodeSelector:
        kubernetes.io/arch: amd64
      restartPolicy: Always
      schedulerName: default-scheduler
      securityContext: {}
      terminationGracePeriodSeconds: 30
  updateStrategy:
    rollingUpdate:
      maxUnavailable: 2
    type: RollingUpdate
```
通过替换镜像模拟发布，实测哪怕拉不到镜像，控制器还是在继续更新，最终导致所有节点上的负载都离线。
## 临时方案
通过label+onDelete策略，手动更新   
现将工作负载的更新策略设置为OnDelete，然后给现在版本的pod全部打上新的label，根据label使用脚本删除，实现完全可控的更新，但是费时间同时也很消耗运维:fearful:
## 在边端预热镜像
可以通过job，daemonset，sts等方式下发临时pod提前预热镜像   
但是job不能很好的做到每个节点调度一个，已经退出的pod不在计算反亲和, ds需要更多方法来控制并发速率，所以还是选择sts   
```yaml
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  annotations: {}
  labels:
    k8s.kuboard.cn/name: ds-image-preload
  name: ds-image-preload
  namespace: reckless
  resourceVersion: '1901184480'
spec:
  podManagementPolicy: OrderedReady
  replicas: 15
  revisionHistoryLimit: 10
  selector:
    matchLabels:
      app: ds-image-preload
      res: sts
  serviceName: ds-image-preload
  template:
    metadata:
      creationTimestamp: null
      labels:
        app: ds-image-preload
        res: sts
    spec:
      affinity:
        podAntiAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            - labelSelector:
                matchLabels:
                  app: ds-image-preload
              topologyKey: kubernetes.io/hostname
      containers:
        - command:
            - sleep
            - 999d
          image: 'busybox'
          imagePullPolicy: IfNotPresent
          name: ds-image-preload
          resources:
            requests:
              memory: 10Mi
          terminationMessagePath: /dev/termination-log
          terminationMessagePolicy: File
      dnsPolicy: ClusterFirst
      nodeSelector:
        factory: wl64
      restartPolicy: Always
      schedulerName: default-scheduler
      securityContext: {}
      terminationGracePeriodSeconds: 1
      tolerations:
        - key: gkj
          operator: Exists
  updateStrategy:
    type: RollingUpdate
```
通过cmdb下发该负载，[跟踪状态](https://blog.gostatus.cn/categories/devops/2024/08/14/daemonset-%E5%8F%91%E5%B8%83%E6%A3%80%E6%9F%A5)，最后完成清理:yum:问题解决

