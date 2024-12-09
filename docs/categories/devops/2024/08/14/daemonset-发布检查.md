---
title: DaemonSet 发布检查
isOriginal: true
isTop: true
author: 宇峰
date: 2024/08/14 22:25
categories:
  - devops
tags:
  - cicd
  - daemonset
  - ControllerRevision
---
# 发布过程中如何检查DaemonSet是否发布成功
常规业务都是deployment为主，但是我们有部署在工控机上的物联业务，这些业务是通过DaemonSet部署的，通过kubeedge将每一台工控机作为边缘节点加入集群。那么如何检查DaemonSet是否发布成功呢？
## 先了解daemonset是如何管理pod的
Deployment管理pod是通过ReplicaSet实现的，而DaemonSet控制器是直接操作pod的，并没有ReplicaSet，他是通过ControllerRevision来管理pod的。

Kubernetes v1.7 之后添加了一个 API 对象，名叫 ControllerRevision，专门用来记录某种 Controller 对象的版本，ControllerRevision 其实是一个通用的版本管理对象。

```shell
[root@master193 ~]# kubectl get ControllerRevision -n litchilinkiot
NAME                          CONTROLLER                        REVISION   AGE
testapp-5d475c78c5         daemonset.apps/testapp         18         29h
```

### 查看这个ControllerRevision的详细信息
```shell
[root@master193 ~]# kubectl get ControllerRevision   banyan-daq-5d475c78c5 -n litchilinkiot -o yaml
apiVersion: apps/v1
data:
  spec:
    template:
      $patch: replace
      metadata:
        creationTimestamp: null
        labels:
          app: banyan-daq
kind: ControllerRevision
metadata:
  annotations:
    deprecated.daemonset.template.generation: "18"
  labels:
    app: testapp
    controller-revision-hash: 5d475c78c5
  name: testapp-5d475c78c5
  namespace: litchilinkiot
revision: 18
```
可以获取到关键的**revision**和**controller-revision-hash**，借此查询到对应的pod信息。
## 代码实例（python）
- 补充判断条件，需要判断当前daemonset的副本数是否为0，如果为0则不需要检查pod状态
```python
   def check_daemonset_ready(self, name, namespace):
        print(f"check_daemonset_ready {name} {namespace}")
        obj = self.get_daemonset(name, namespace)
        if not obj:
            return False, f"{name} not found"

        observedGeneration = obj.metadata.generation
        if observedGeneration == '0':
            return False, f"{name} get observedGeneration failed"
        status_observedGeneration = obj.status.observed_generation
        if status_observedGeneration != observedGeneration:
            return False, "{name} status not updated"
        desiredNumberScheduled = obj.status.desired_number_scheduled
        numberAvailable = obj.status.number_available
        numberReady = obj.status.number_ready
        # 判断updatedNumberScheduled == desiredNumberScheduled
        try:
            updatedNumberScheduled = obj.status.updated_number_scheduled
        except AttributeError:
            return False, f"{name} updatedNumberScheduled not found"
        if updatedNumberScheduled:
            if updatedNumberScheduled < desiredNumberScheduled:
                return False, f"{name} updatedNumberScheduled/desired={updatedNumberScheduled}/{desiredNumberScheduled}"
        else:
            return False, f"{name} updatedNumberScheduled not found"
        if not (desiredNumberScheduled == numberAvailable == numberReady):
            return False, f"{name} ready/replicas/desired={numberReady}/{numberAvailable}/{desiredNumberScheduled}"
        # 获取控制器版本ControllerRevision
        crs = self.get_controller_revision(namespace, obj.spec.selector.match_labels)
        if not crs:
            return False, f"{name} no ControllerRevision"
        match_labels = {}
        for cr in crs.items:
            if cr.revision == observedGeneration:
                match_labels = cr.metadata.labels
        if not match_labels:
            return False, f"{name} no controller_revision_hash"
        # 检查对应的pod状态
        pods = self.get_pod_list(namespace, match_labels)
        if not pods:
            print(f"{name} no pods")
            return True, f"{name} no pods"
        for pod in pods.items:
            if not self.check_pod_ready(pod):
                return False, f"{name} pod {pod.metadata.name} not ready"
        return True, f"{name} ready/replicas/desired={numberReady}/{numberAvailable}/{desiredNumberScheduled}"
```