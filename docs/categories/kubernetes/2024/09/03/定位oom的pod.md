---
title: 定位oom的pod
date: 2024-09-03 00:00:00
categories: [kubernetes]
tags: [kubernetes, oom]
---
# 快速从主机oom日志中定位oom的pod
::: tip
除了操作系统因为内存不足导致的oom之外，k8s集群中的pod也会因为超出limit的内存使用量被oom-killer杀掉。
如果有event持久化，可以通过event查看，如果没有event记录，只能从主机的日志中获取信息了，但主机日志是包含集群中的信息的，需要用点小办法。
:::
## 获取oom日志
dmsg和syslog中会记录oom的信息，核心日志是下面的内容
```shell
[二 9月  3 05:57:48 2024] oom-kill:constraint=CONSTRAINT_MEMCG,nodemask=(null),cpuset=3e5e5eab87df615f4777e6f7f261a7fb62f4a7ee5bc3e25e3a5b5223ccd368fe,mems_allowed=0-1,oom_memcg=/kubepods/burstable/pod28fcb1a0-a45c-44e7-b9bf-e3b9360bedba,task_memcg=/kubepods/burstable/pod28fcb1a0-a45c-44e7-b9bf-e3b9360bedba/3e5e5eab87df615f4777e6f7f261a7fb62f4a7ee5bc3e25e3a5b5223ccd368fe,task=java,pid=50624,uid=10000
[二 9月  3 05:57:48 2024] Memory cgroup out of memory: Killed process 50624 (java) total-vm:59726088kB, anon-rss:8225208kB, file-rss:26912kB, shmem-rss:0kB, UID:10000 pgtables:21384kB oom_score_adj:969
```
## 分析日志
从日志中可以获取到cgrouppath的id，pod28fcb1a0-a45c-44e7-b9bf-e3b9360bedba，然后通过查询主机上的cgroup信息，可以获取到pod进程号，然后通过进程号查询pod的环境变量等，最终定位到pod的信息。
```shell
# 进入基础目录
cd /sys/fs/cgroup/systemd/
# 查看对应的cgroup信息
[root@master192 systemd]# ls
cgroup.clone_children  cgroup.procs  cgroup.sane_behavior  kubepods  notify_on_release  release_agent  system.slice  tasks  user.slice
# 进入到上面对应的目录
cd kubepods/burstable/pod28fcb1a0-a45c-44e7-b9bf-e3b9360bedba
# 目录内容
[root@master192 pod28fcb1a0-a45c-44e7-b9bf-e3b9360bedba]# ls -l
总用量 0
drwxr-xr-x 2 root root 0 9月   3 05:57 a9c2e7b40f1389708c5de0fac20107712f0681ea3c403db44736690a9fd81ee9  # 容器1
-rw-r--r-- 1 root root 0 9月   3 09:34 cgroup.clone_children
-rw-r--r-- 1 root root 0 9月   3 09:34 cgroup.procs
drwxr-xr-x 2 root root 0 6月  16 11:53 dfd2da67af865b072ef5a2fd7007c474f6c454379d75cdcb628cf71402f5f94f #容器2
-rw-r--r-- 1 root root 0 9月   3 09:34 notify_on_release
-rw-r--r-- 1 root root 0 9月   3 09:34 tasks
# 这里其实不一定只有两个容器，最少两个，因为pod有pause容器
# 分别查看进程号，少的那个是pause容器
# 通过查看pause容器的tasks文件，可以获取到pause容器的进程号
[root@master192 pod28fcb1a0-a45c-44e7-b9bf-e3b9360bedba]# cat dfd2da67af865b072ef5a2fd7007c474f6c454379d75cdcb628cf71402f5f94f/tasks 
49974
# 通过进程号查看进程的环境变量
[root@master192 pod28fcb1a0-a45c-44e7-b9bf-e3b9360bedba]# strings /proc/49974/environ 
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
HOSTNAME=pulsar-broker-0
HOME=/
# 基本就定位到了pod信息
```
## 总结
相对于结果而言, 这个过程只是加深了对pod模型和cgroup的理解，真正的生产环境中最好是最好集群事件的持久化，以及监控告警设施的建设。   
最后最后，其实 docker ps -a 也可以轻松发现137退出码的容器，然后通过docker logs查看日志，也可以定位到问题。(你知道这个操作的底层原理是什么？)


